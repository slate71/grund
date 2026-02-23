import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import type { ServerResponse } from 'node:http'
import {
  validateEnvironment,
  createApp,
  createHeartbeatFunction,
  initializeConnections,
} from './app'
import type { Client } from 'pg'

interface MockPgClient {
  connect: Mock
  query: Mock
  on: Mock
  end: Mock
}

interface MockRedisClient {
  connect: Mock
  publish: Mock
  isReady: boolean
  on: Mock
}

// Cast helpers to pass mocks to production functions
const asPg = (mock: MockPgClient) => mock as unknown as Client
const asRedis = (mock: MockRedisClient) => mock as unknown as import('./app').RedisClient

describe('Heartbeat Agent App', () => {
  let mockPgClient: MockPgClient
  let mockRedisClient: MockRedisClient
  let sseClients: Set<ServerResponse>
  let isPostgresConnected: boolean
  let isHeartbeatRunning: { value: boolean }

  beforeEach(() => {
    // Reset mocks
    mockPgClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      on: vi.fn(),
      end: vi.fn(),
    }

    mockRedisClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      isReady: true,
      on: vi.fn(),
    }

    sseClients = new Set<ServerResponse>()
    isPostgresConnected = true
    isHeartbeatRunning = { value: false }

    // Set required environment variables
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.AGENT_NAME = 'test-heartbeat'
  })

  describe('validateEnvironment', () => {
    it('should pass when all required env vars are set', () => {
      expect(() => validateEnvironment()).not.toThrow()
    })

    it('should exit when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit')
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => validateEnvironment()).toThrow('Process exit')
      expect(consoleSpy).toHaveBeenCalledWith(
        'ERROR: DATABASE_URL environment variable is required',
      )

      exitSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('should exit when REDIS_URL is missing', () => {
      delete process.env.REDIS_URL
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit')
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => validateEnvironment()).toThrow('Process exit')
      expect(consoleSpy).toHaveBeenCalledWith('ERROR: REDIS_URL environment variable is required')

      exitSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('createApp', () => {
    it('should create a fastify app with all endpoints', () => {
      const app = createApp(
        asPg(mockPgClient),
        asRedis(mockRedisClient),
        sseClients,
        () => isPostgresConnected,
      )
      expect(app).toBeDefined()
      expect(app.get).toBeDefined()
      expect(app.listen).toBeDefined()
    })

    describe('Health Endpoint', () => {
      it('should return healthy status', async () => {
        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/health',
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers['content-type']).toMatch(/json/)
        expect(response.json()).toEqual({
          status: 'healthy',
          uptime: expect.any(Number),
          connections: {
            postgres: true,
            redis: true,
            sseClients: 0,
          },
        })
      })

      it('should reflect postgres connection status', async () => {
        isPostgresConnected = false
        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/health',
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().connections.postgres).toBe(false)
      })

      it('should reflect redis connection status', async () => {
        mockRedisClient.isReady = false
        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/health',
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().connections.redis).toBe(false)
      })

      it('should count SSE clients', async () => {
        const mockClient = {} as ServerResponse
        sseClients.add(mockClient)

        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/health',
        })
        expect(response.statusCode).toBe(200)
        expect(response.json().connections.sseClients).toBe(1)
      })
    })

    describe('Recent Heartbeats Endpoint', () => {
      it('should return heartbeats from database', async () => {
        const mockHeartbeats = [
          {
            id: 1,
            timestamp: '2024-01-01T00:00:00Z',
            agent_name: 'test-heartbeat',
            status: 'alive',
            metadata: { uptime: 100 },
          },
        ]
        mockPgClient.query.mockResolvedValueOnce({ rows: mockHeartbeats })

        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/heartbeat/recent',
        })

        expect(response.statusCode).toBe(200)
        expect(response.headers['content-type']).toMatch(/json/)
        expect(response.json()).toEqual(mockHeartbeats)
        expect(mockPgClient.query).toHaveBeenCalledWith(
          'SELECT * FROM heartbeats ORDER BY timestamp DESC LIMIT 10',
        )
      })

      it('should handle database errors', async () => {
        mockPgClient.query.mockRejectedValueOnce(new Error('Database error'))

        const app = createApp(
          asPg(mockPgClient),
          asRedis(mockRedisClient),
          sseClients,
          () => isPostgresConnected,
        )

        const response = await app.inject({
          method: 'GET',
          url: '/heartbeat/recent',
        })

        expect(response.statusCode).toBe(500)
        expect(response.headers['content-type']).toMatch(/json/)
        expect(response.json()).toEqual({ error: 'Failed to fetch heartbeats' })
      })
    })
  })

  describe('createHeartbeatFunction', () => {
    it('should send heartbeat successfully', async () => {
      const mockResult = {
        rows: [{ id: 1 }],
      }
      mockPgClient.query.mockResolvedValueOnce(mockResult)

      const sendHeartbeat = createHeartbeatFunction(
        asPg(mockPgClient),
        asRedis(mockRedisClient),
        sseClients,
        isHeartbeatRunning,
      )

      await sendHeartbeat()

      expect(mockPgClient.query).toHaveBeenCalledWith(
        'INSERT INTO heartbeats (timestamp, agent_name, status, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
        expect.arrayContaining([
          expect.any(String),
          'test-heartbeat',
          'alive',
          expect.objectContaining({
            uptime: expect.any(Number),
            memory: expect.any(Object),
          }),
        ]),
      )

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'heartbeat',
        expect.stringContaining('"agent":"test-heartbeat"'),
      )

      expect(isHeartbeatRunning.value).toBe(false)
    })

    it('should prevent concurrent executions', async () => {
      isHeartbeatRunning.value = true
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const sendHeartbeat = createHeartbeatFunction(
        asPg(mockPgClient),
        asRedis(mockRedisClient),
        sseClients,
        isHeartbeatRunning,
      )

      await sendHeartbeat()

      expect(consoleSpy).toHaveBeenCalledWith('Heartbeat already in progress, skipping...')
      expect(mockPgClient.query).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle errors gracefully', async () => {
      mockPgClient.query.mockRejectedValueOnce(new Error('Database error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const sendHeartbeat = createHeartbeatFunction(
        asPg(mockPgClient),
        asRedis(mockRedisClient),
        sseClients,
        isHeartbeatRunning,
      )

      await sendHeartbeat()

      expect(consoleSpy).toHaveBeenCalledWith('Failed to send heartbeat:', expect.any(Error))
      expect(isHeartbeatRunning.value).toBe(false) // Should reset flag even on error

      consoleSpy.mockRestore()
    })

    it('should broadcast to SSE clients', async () => {
      const mockClient = {
        write: vi.fn(),
      } as unknown as ServerResponse
      sseClients.add(mockClient)

      mockPgClient.query.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      })

      const sendHeartbeat = createHeartbeatFunction(
        asPg(mockPgClient),
        asRedis(mockRedisClient),
        sseClients,
        isHeartbeatRunning,
      )

      await sendHeartbeat()

      expect(mockClient.write).toHaveBeenCalledWith(expect.stringContaining('data: {'))
    })
  })

  describe('initializeConnections', () => {
    it('should connect to databases and create table', async () => {
      await initializeConnections(asPg(mockPgClient), asRedis(mockRedisClient))

      expect(mockPgClient.connect).toHaveBeenCalled()
      expect(mockRedisClient.connect).toHaveBeenCalled()
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS heartbeats'),
      )
    })

    it('should create table with correct schema', async () => {
      await initializeConnections(asPg(mockPgClient), asRedis(mockRedisClient))

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('timestamp TIMESTAMPTZ'),
      )
    })

    it('should create index on timestamp column', async () => {
      await initializeConnections(asPg(mockPgClient), asRedis(mockRedisClient))

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp'),
      )
    })
  })

  describe('cleanupOldHeartbeats', () => {
    it('should delete old heartbeat records', async () => {
      const { cleanupOldHeartbeats } = await import('./app')
      mockPgClient.query.mockResolvedValueOnce({
        rowCount: 100,
        rows: [],
      })

      const deletedCount = await cleanupOldHeartbeats(asPg(mockPgClient), 30)

      expect(deletedCount).toBe(100)
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM heartbeats'),
      )
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE timestamp < NOW() - INTERVAL '30 days'"),
      )
    })

    it('should handle cleanup errors gracefully', async () => {
      const { cleanupOldHeartbeats } = await import('./app')
      mockPgClient.query.mockRejectedValueOnce(new Error('Database error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const deletedCount = await cleanupOldHeartbeats(asPg(mockPgClient), 30)

      expect(deletedCount).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cleanup old heartbeats:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('should use custom retention days', async () => {
      const { cleanupOldHeartbeats } = await import('./app')
      mockPgClient.query.mockResolvedValueOnce({
        rowCount: 50,
        rows: [],
      })

      await cleanupOldHeartbeats(asPg(mockPgClient), 7)

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE timestamp < NOW() - INTERVAL '7 days'"),
      )
    })

    it('should log when records are deleted', async () => {
      const { cleanupOldHeartbeats } = await import('./app')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockPgClient.query.mockResolvedValueOnce({
        rowCount: 75,
        rows: [],
      })

      await cleanupOldHeartbeats(asPg(mockPgClient), 30)

      expect(consoleSpy).toHaveBeenCalledWith('Cleaned up 75 heartbeat records older than 30 days')

      consoleSpy.mockRestore()
    })
  })
})
