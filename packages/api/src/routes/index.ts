import type { FastifyInstance } from 'fastify'
import type { Database } from '@grund/db'
import { registerEventRoutes } from './events'

export function registerRoutes(app: FastifyInstance, db: Database) {
  // Health check
  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' })
  })

  // Register domain-specific routes
  registerEventRoutes(app, db)

  // Future route modules will be added here:
  // registerDailyBriefRoutes(app, db)
  // registerCareerRoutes(app, db)
  // registerFinanceRoutes(app, db)
}