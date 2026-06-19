import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { Client } from 'pg'
import { getRecentTransactions, getSpendingByCategory } from './db'
import type { Logger } from '@grund/logger'

export interface RedisClient {
  connect(): Promise<unknown>
  publish(channel: string, message: string): Promise<number>
  isReady: boolean
  set(key: string, value: string, options?: unknown): Promise<unknown>
  on(event: string, listener: (...args: unknown[]) => void): void
}

export function validateEnvironment(log: Logger) {
  const required = ['DATABASE_URL', 'REDIS_URL', 'CREDENTIAL_PROXY_URL']
  for (const key of required) {
    if (!process.env[key]) {
      log.error(`${key} environment variable is required`)
      process.exit(1)
    }
  }
}

export function createApp(
  pgClient: Client,
  redisClient: RedisClient,
  isPostgresConnected: () => boolean,
  log: Logger,
): FastifyInstance {
  const app = Fastify({ loggerInstance: log })

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

  // Most recent transactions, newest first.
  app.get('/finance/transactions', async (request, reply) => {
    try {
      const limit = parseLimit((request.query as { limit?: string }).limit, 50)
      return await getRecentTransactions(pgClient, limit)
    } catch {
      reply.code(500)
      return { error: 'Failed to fetch transactions' }
    }
  })

  // Spending grouped by category over a trailing window (default 30 days).
  app.get('/finance/spending', async (request, reply) => {
    try {
      const days = parseLimit((request.query as { days?: string }).days, 30)
      return await getSpendingByCategory(pgClient, days)
    } catch {
      reply.code(500)
      return { error: 'Failed to fetch spending' }
    }
  })

  return app
}

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}
