import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { ServerResponse } from 'node:http'
import { Client } from 'pg'
import type { Logger } from '@grund/logger'

export interface RedisClient {
  connect(): Promise<unknown>
  publish(channel: string, message: string): Promise<number>
  isReady: boolean
  on(event: string, listener: (...args: unknown[]) => void): void
}

export function validateEnvironment(log: Logger) {
  if (!process.env.DATABASE_URL) {
    log.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  if (!process.env.REDIS_URL) {
    log.error('REDIS_URL environment variable is required')
    process.exit(1)
  }
}

export function createApp(
  pgClient: Client,
  redisClient: RedisClient,
  sseClients: Set<ServerResponse>,
  isPostgresConnected: () => boolean,
): FastifyInstance {
  const app = Fastify()

  app.get('/heartbeat/stream', (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')

    reply.raw.write('data: {"connected": true}\n\n')

    sseClients.add(reply.raw)

    request.raw.on('close', () => {
      sseClients.delete(reply.raw)
    })

    reply.hijack()
  })

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

export function createHeartbeatFunction(
  pgClient: Client,
  redisClient: RedisClient,
  sseClients: Set<ServerResponse>,
  isHeartbeatRunning: { value: boolean },
  log: Logger,
) {
  return async function sendHeartbeat() {
    if (isHeartbeatRunning.value) {
      log.debug('Heartbeat already in progress, skipping')
      return
    }

    isHeartbeatRunning.value = true
    const timestamp = new Date().toISOString()
    const agentName = process.env.AGENT_NAME || 'heartbeat'

    try {
      const result = await pgClient.query(
        'INSERT INTO heartbeats (timestamp, agent_name, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          timestamp,
          agentName,
          'alive',
          { uptime: process.uptime(), memory: process.memoryUsage() },
        ],
      )

      await redisClient.publish(
        'heartbeat',
        JSON.stringify({
          timestamp,
          agent: agentName,
          id: result.rows[0].id,
        }),
      )

      const heartbeatData = {
        id: result.rows[0].id,
        timestamp,
        agent: agentName,
        status: 'alive',
      }

      sseClients.forEach((client) => {
        client.write(`data: ${JSON.stringify(heartbeatData)}\n\n`)
      })

      log.info({ timestamp }, 'Heartbeat sent')
    } catch (error) {
      log.error({ err: error }, 'Failed to send heartbeat')
    } finally {
      isHeartbeatRunning.value = false
    }
  }
}

export async function initializeConnections(pgClient: Client, redisClient: RedisClient, log: Logger) {
  await pgClient.connect()
  await redisClient.connect()
  log.info('Connected to PostgreSQL and Redis')

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      agent_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'alive',
      metadata JSONB
    )
  `)

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp
    ON heartbeats(timestamp)
  `)
}

export async function cleanupOldHeartbeats(
  pgClient: Client,
  retentionDays: number = 30,
  log: Logger,
): Promise<number> {
  try {
    const result = await pgClient.query(
      `DELETE FROM heartbeats
       WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
       RETURNING id`,
    )

    const deletedCount = result.rowCount || 0
    if (deletedCount > 0) {
      log.info({ deletedCount, retentionDays }, 'Cleaned up old heartbeat records')
    }
    return deletedCount
  } catch (error) {
    log.error({ err: error }, 'Failed to cleanup old heartbeats')
    return 0
  }
}
