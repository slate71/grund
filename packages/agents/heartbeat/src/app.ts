import express from 'express'
import type { Response } from 'express'
import { Client } from 'pg'

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

// Create Express app
export function createApp(
  pgClient: Client,
  redisClient: any,
  sseClients: Set<Response>,
  isPostgresConnected: () => boolean,
) {
  const app = express()

  // SSE endpoint
  app.get('/heartbeat/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Send initial connection message
    res.write('data: {"connected": true}\n\n')

    // Add client to set
    sseClients.add(res)

    // Remove client on disconnect
    req.on('close', () => {
      sseClients.delete(res)
    })
  })

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      connections: {
        postgres: isPostgresConnected(),
        redis: redisClient.isReady,
        sseClients: sseClients.size,
      },
    })
  })

  // Get recent heartbeats
  app.get('/heartbeat/recent', async (req, res) => {
    try {
      const result = await pgClient.query(
        'SELECT * FROM heartbeats ORDER BY timestamp DESC LIMIT 10',
      )
      res.json(result.rows)
    } catch {
      res.status(500).json({ error: 'Failed to fetch heartbeats' })
    }
  })

  return app
}

// Create heartbeat function
export function createHeartbeatFunction(
  pgClient: Client,
  redisClient: any,
  sseClients: Set<Response>,
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
