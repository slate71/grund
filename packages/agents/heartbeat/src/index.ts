import express from 'express'
import type { Response } from 'express'
import { Client } from 'pg'
import { createClient } from 'redis'
import cron from 'node-cron'

const app = express()
const PORT = process.env.PORT || 3001

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

if (!process.env.REDIS_URL) {
  console.error('ERROR: REDIS_URL environment variable is required')
  process.exit(1)
}

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
let isHeartbeatRunning = false

// Initialize connections
async function init() {
  try {
    await pgClient.connect()
    isPostgresConnected = true
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

// Heartbeat function with concurrency protection
async function sendHeartbeat() {
  // Prevent overlapping heartbeat executions
  if (isHeartbeatRunning) {
    console.log('Heartbeat already in progress, skipping...')
    return
  }

  isHeartbeatRunning = true
  const timestamp = new Date().toISOString()
  const agentName = process.env.AGENT_NAME || 'heartbeat'

  try {
    // Log to database
    const result = await pgClient.query(
      'INSERT INTO heartbeats (timestamp, agent_name, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [timestamp, agentName, 'alive', { uptime: process.uptime(), memory: process.memoryUsage() }],
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
    isHeartbeatRunning = false
  }
}

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
      postgres: isPostgresConnected,
      redis: redisClient.isReady,
      sseClients: sseClients.size,
    },
  })
})

// Get recent heartbeats
app.get('/heartbeat/recent', async (req, res) => {
  try {
    const result = await pgClient.query('SELECT * FROM heartbeats ORDER BY timestamp DESC LIMIT 10')
    res.json(result.rows)
  } catch {
    res.status(500).json({ error: 'Failed to fetch heartbeats' })
  }
})

// Start server and initialize
async function start() {
  await init()

  // Schedule heartbeat every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    sendHeartbeat()
  })

  // Send initial heartbeat on startup
  await sendHeartbeat()

  app.listen(PORT, () => {
    console.log(`Heartbeat agent running on port ${PORT}`)
    console.log(`SSE stream available at http://localhost:${PORT}/heartbeat/stream`)
  })
}

start().catch(console.error)
