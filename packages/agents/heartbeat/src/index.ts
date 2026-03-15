import type { ServerResponse } from 'node:http'
import { Client } from 'pg'
import { createClient } from 'redis'
import cron from 'node-cron'
import {
  validateEnvironment,
  createApp,
  createHeartbeatFunction,
  initializeConnections,
  cleanupOldHeartbeats,
  type RedisClient,
} from './app'
import { createLogger } from '@grund/logger'

const PORT = parseInt(process.env.PORT || '3001', 10)

const log = createLogger('heartbeat')

validateEnvironment(log)

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
})

const redisClient = createClient({
  url: process.env.REDIS_URL,
}) as unknown as RedisClient

const sseClients = new Set<ServerResponse>()

let isPostgresConnected = false

const isHeartbeatRunning = { value: false }

async function init() {
  try {
    await initializeConnections(pgClient, redisClient, log)
    isPostgresConnected = true
  } catch (error) {
    log.error({ err: error }, 'Failed to initialize connections')
    isPostgresConnected = false
    process.exit(1)
  }
}

pgClient.on('error', (err: Error) => {
  log.error({ err }, 'PostgreSQL client error')
  isPostgresConnected = false
})

pgClient.on('end', () => {
  log.info('PostgreSQL connection closed')
  isPostgresConnected = false
})

const sendHeartbeat = createHeartbeatFunction(pgClient, redisClient, sseClients, isHeartbeatRunning, log)

const app = createApp(pgClient, redisClient, sseClients, () => isPostgresConnected)

async function start() {
  await init()

  cron.schedule('*/5 * * * *', () => {
    sendHeartbeat()
  })

  cron.schedule('0 2 * * *', async () => {
    log.info('Running daily heartbeat cleanup')
    const retentionDays = parseInt(process.env.HEARTBEAT_RETENTION_DAYS || '30')
    const deletedCount = await cleanupOldHeartbeats(pgClient, retentionDays, log)
    log.info({ deletedCount }, 'Daily cleanup completed')
  })

  await sendHeartbeat()

  log.info('Running initial heartbeat cleanup')
  const retentionDays = parseInt(process.env.HEARTBEAT_RETENTION_DAYS || '30')
  await cleanupOldHeartbeats(pgClient, retentionDays, log)

  await app.listen({ port: PORT, host: '0.0.0.0' })
  log.info({ port: PORT }, 'Heartbeat agent running')
  log.info({ url: `http://localhost:${PORT}/heartbeat/stream` }, 'SSE stream available')
  log.info({ retentionDays }, 'Retention policy')
}

start().catch(log.error.bind(log))
