import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createDb } from '@grund/db'
import { registerRoutes } from './routes/index'

const port = parseInt(process.env.PORT || '3001', 10)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const db = createDb(databaseUrl)
const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

registerRoutes(app, db)

try {
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API server running on http://localhost:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
