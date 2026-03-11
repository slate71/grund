import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { Client } from 'pg'
import type { RedisClient } from './gmail/poller'
import { getRecentEmails, getTriageStats } from './db'

export function validateEnvironment() {
  const required = ['DATABASE_URL', 'REDIS_URL', 'CREDENTIAL_PROXY_URL']
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`ERROR: ${key} environment variable is required`)
      process.exit(1)
    }
  }
}

export function createApp(
  pgClient: Client,
  redisClient: RedisClient,
  isPostgresConnected: () => boolean,
): FastifyInstance {
  const app = Fastify()

  app.get('/health', async () => {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      connections: {
        postgres: isPostgresConnected(),
        redis: redisClient.isReady,
      },
    }
  })

  app.get('/triage/recent', async (_request, reply) => {
    try {
      return await getRecentEmails(pgClient)
    } catch {
      reply.code(500)
      return { error: 'Failed to fetch recent emails' }
    }
  })

  app.get('/triage/stats', async (_request, reply) => {
    try {
      return await getTriageStats(pgClient)
    } catch {
      reply.code(500)
      return { error: 'Failed to fetch triage stats' }
    }
  })

  return app
}
