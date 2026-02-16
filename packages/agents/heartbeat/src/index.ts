import type { Response } from 'express'
import { Client } from 'pg'
import { createClient } from 'redis'
import cron from 'node-cron'
import {
  validateEnvironment,
  createApp,
  createHeartbeatFunction,
  initializeConnections,
  cleanupOldHeartbeats,
} from './app'

const PORT = process.env.PORT || 3001

// Validate required environment variables
validateEnvironment()

// Database connection
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
})

// Redis connection
const redisClient = createClient({
  url: process.env.REDIS_URL,
})

// Store for SSE clients
const sseClients = new Set<Response>()

// Track PostgreSQL connection status
let isPostgresConnected = false

// Track if heartbeat is currently running
const isHeartbeatRunning = { value: false }

// Initialize connections
async function init() {
  try {
    await initializeConnections(pgClient, redisClient)
    isPostgresConnected = true
  } catch (error) {
    console.error('Failed to initialize connections:', error)
    isPostgresConnected = false
    process.exit(1)
  }
}

// Setup PostgreSQL event listeners
pgClient.on('error', (err) => {
  console.error('PostgreSQL client error:', err)
  isPostgresConnected = false
})

pgClient.on('end', () => {
  console.log('PostgreSQL connection closed')
  isPostgresConnected = false
})

// Create heartbeat function
const sendHeartbeat = createHeartbeatFunction(pgClient, redisClient, sseClients, isHeartbeatRunning)

// Create app with endpoints
const app = createApp(pgClient, redisClient, sseClients, () => isPostgresConnected)

// Start server and initialize
async function start() {
  await init()

  // Schedule heartbeat every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    sendHeartbeat()
  })

  // Schedule cleanup job daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running daily heartbeat cleanup...')
    const retentionDays = parseInt(process.env.HEARTBEAT_RETENTION_DAYS || '30')
    const deletedCount = await cleanupOldHeartbeats(pgClient, retentionDays)
    console.log(`Daily cleanup completed. Removed ${deletedCount} old records.`)
  })

  // Send initial heartbeat on startup
  await sendHeartbeat()

  // Run initial cleanup on startup (in case we haven't run in a while)
  console.log('Running initial heartbeat cleanup...')
  const retentionDays = parseInt(process.env.HEARTBEAT_RETENTION_DAYS || '30')
  await cleanupOldHeartbeats(pgClient, retentionDays)

  app.listen(PORT, () => {
    console.log(`Heartbeat agent running on port ${PORT}`)
    console.log(`SSE stream available at http://localhost:${PORT}/heartbeat/stream`)
    console.log(`Retention policy: keeping last ${retentionDays} days of heartbeats`)
  })
}

start().catch(console.error)
