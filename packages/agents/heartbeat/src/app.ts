import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { ServerResponse } from 'node:http'
import { Client } from 'pg'
import { createDb, contacts } from '@grund/db'
import { and, lte, or, eq } from 'drizzle-orm'

// Validate required environment variables
export function validateEnvironment() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  if (!process.env.REDIS_URL) {
    console.error('ERROR: REDIS_URL environment variable is required')
    process.exit(1)
  }
}

// Create Fastify app
export function createApp(
  pgClient: Client,
  redisClient: any,
  sseClients: Set<ServerResponse>,
  isPostgresConnected: () => boolean,
): FastifyInstance {
  const app = Fastify()

  // SSE endpoint
  app.get('/heartbeat/stream', (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')

    // Send initial connection message
    reply.raw.write('data: {"connected": true}\n\n')

    // Add client to set
    sseClients.add(reply.raw)

    // Remove client on disconnect
    request.raw.on('close', () => {
      sseClients.delete(reply.raw)
    })

    // Prevent Fastify from ending the response
    reply.hijack()
  })

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      connections: {
        postgres: isPostgresConnected(),
        redis: redisClient.isReady,
        sseClients: sseClients.size,
      },
    }
  })

  // Get recent heartbeats
  app.get('/heartbeat/recent', async (_request, reply) => {
    try {
      const result = await pgClient.query(
        'SELECT * FROM heartbeats ORDER BY timestamp DESC LIMIT 10',
      )
      return result.rows
    } catch {
      reply.code(500)
      return { error: 'Failed to fetch heartbeats' }
    }
  })

  return app
}

// Create heartbeat function
export function createHeartbeatFunction(
  pgClient: Client,
  redisClient: any,
  sseClients: Set<ServerResponse>,
  isHeartbeatRunning: { value: boolean },
) {
  return async function sendHeartbeat() {
    // Prevent overlapping heartbeat executions
    if (isHeartbeatRunning.value) {
      console.log('Heartbeat already in progress, skipping...')
      return
    }

    isHeartbeatRunning.value = true
    const timestamp = new Date().toISOString()
    const agentName = process.env.AGENT_NAME || 'heartbeat'

    try {
      // Log to database
      const result = await pgClient.query(
        'INSERT INTO heartbeats (timestamp, agent_name, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          timestamp,
          agentName,
          'alive',
          { uptime: process.uptime(), memory: process.memoryUsage() },
        ],
      )

      // Publish to Redis for other services
      await redisClient.publish(
        'heartbeat',
        JSON.stringify({
          timestamp,
          agent: agentName,
          id: result.rows[0].id,
        }),
      )

      // Broadcast to SSE clients
      const heartbeatData = {
        id: result.rows[0].id,
        timestamp,
        agent: agentName,
        status: 'alive',
      }

      sseClients.forEach((client) => {
        client.write(`data: ${JSON.stringify(heartbeatData)}\n\n`)
      })

      console.log(`Heartbeat sent at ${timestamp}`)

      // Check for due contact followups
      const dueCount = await checkContactFollowups(redisClient)
      if (dueCount > 0) {
        console.log(`Contact followup check: ${dueCount} contacts need attention`)
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error)
    } finally {
      isHeartbeatRunning.value = false
    }
  }
}

// Initialize database connections
export async function initializeConnections(pgClient: Client, redisClient: any) {
  await pgClient.connect()
  await redisClient.connect()
  console.log('Connected to PostgreSQL and Redis')

  // Create heartbeat table if it doesn't exist
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      agent_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'alive',
      metadata JSONB
    )
  `)

  // Create index on timestamp for efficient cleanup queries
  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp
    ON heartbeats(timestamp)
  `)
}

// Cleanup old heartbeat records
export async function cleanupOldHeartbeats(
  pgClient: Client,
  retentionDays: number = 30,
): Promise<number> {
  try {
    const result = await pgClient.query(
      `DELETE FROM heartbeats
       WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
       RETURNING id`,
    )

    const deletedCount = result.rowCount || 0
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} heartbeat records older than ${retentionDays} days`)
    }
    return deletedCount
  } catch (error) {
    console.error('Failed to cleanup old heartbeats:', error)
    return 0
  }
}

// Check for due followups
export async function checkContactFollowups(redisClient: any) {
  try {
    const db = createDb(process.env.DATABASE_URL!)

    // Get contacts that need follow-up (contacted/replied 3+ days ago)
    const daysThreshold = 3
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const dueContacts = await db.select()
      .from(contacts)
      .where(
        and(
          lte(contacts.last_touch_date, cutoffDateStr),
          or(
            eq(contacts.status, 'contacted'),
            eq(contacts.status, 'replied')
          )
        )
      )
      .orderBy(contacts.last_touch_date)

    if (dueContacts.length > 0) {
      // Push each contact to Redis for processing
      for (const contact of dueContacts) {
        await redisClient.rPush(
          'grund:followups:due',
          JSON.stringify({
            id: contact.id,
            name: contact.name,
            company: contact.company,
            channel: contact.channel,
            last_touch_date: contact.last_touch_date,
            status: contact.status,
            next_action: contact.next_action,
            timestamp: new Date().toISOString(),
          })
        )
      }

      console.log(`Found ${dueContacts.length} contacts due for follow-up`)
      console.log('Due contacts pushed to Redis queue: grund:followups:due')

      // Set expiration on the list (24 hours)
      await redisClient.expire('grund:followups:due', 86400)
    }

    return dueContacts.length
  } catch (error) {
    console.error('Failed to check contact followups:', error)
    return 0
  }
}
