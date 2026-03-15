import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processHistory } from '../src/gmail/history'
import type { RedisClient } from '../src/gmail/poller'
import type { GmailClient } from '../src/gmail/client'
import { createMockLog } from './helpers'

function createMockRedis(): RedisClient {
  const store = new Map<string, string>()
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve('OK')
    }),
    publish: vi.fn().mockResolvedValue(1),
    isReady: true,
    on: vi.fn(),
  }
}

function createMockGmail(): GmailClient {
  return {
    account: 'test',
    getProfile: vi.fn().mockResolvedValue({ emailAddress: 'test@test.com', historyId: '1000' }),
    listHistory: vi.fn().mockResolvedValue({ historyId: '1001', history: [] }),
    getMessage: vi.fn().mockResolvedValue({
      id: 'msg-1',
      threadId: 'thread-1',
      labelIds: ['INBOX'],
      internalDate: '1710000000000',
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'From', value: 'test@example.com' },
          { name: 'To', value: 'me@example.com' },
          { name: 'Subject', value: 'Test' },
        ],
        body: { data: Buffer.from('Hello').toString('base64url') },
      },
    }),
  } as unknown as GmailClient
}

describe('processHistory', () => {
  let redis: RedisClient
  let gmail: ReturnType<typeof createMockGmail>
  let onNewMessage: ReturnType<typeof vi.fn>
  const historyIdKey = 'email-triage:test:historyId'

  beforeEach(() => {
    redis = createMockRedis()
    gmail = createMockGmail()
    onNewMessage = vi.fn().mockResolvedValue(undefined)
  })

  it('re-initializes from profile when no historyId in Redis', async () => {
    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(gmail.getProfile).toHaveBeenCalled()
    expect(redis.set).toHaveBeenCalledWith(historyIdKey, '1000')
    expect(gmail.listHistory).not.toHaveBeenCalled()
  })

  it('processes new messages from history', async () => {
    await redis.set(historyIdKey, '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
        { id: '1001', messagesAdded: [{ message: { id: 'msg-2', threadId: 't-2' } }] },
      ],
    })

    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(onNewMessage).toHaveBeenCalledTimes(2)
  })

  it('deduplicates message IDs', async () => {
    await redis.set(historyIdKey, '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
        { id: '1001', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
      ],
    })

    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(onNewMessage).toHaveBeenCalledTimes(1)
  })

  it('updates historyId after processing', async () => {
    await redis.set(historyIdKey, '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1005',
      history: [],
    })

    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(redis.set).toHaveBeenCalledWith(historyIdKey, '1005')
  })

  it('handles history expired by re-syncing from profile', async () => {
    await redis.set(historyIdKey, '999')

    const { HistoryExpiredError } = await import('../src/gmail/client')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HistoryExpiredError('expired'),
    )

    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(gmail.getProfile).toHaveBeenCalled()
    expect(redis.set).toHaveBeenCalledWith(historyIdKey, '1000')
  })

  it('skips 404 messages gracefully', async () => {
    await redis.set(historyIdKey, '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
      ],
    })
    ;(gmail.getMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('getMessage failed: 404 Not Found'),
    )

    await processHistory({ gmail, redis, onNewMessage, historyIdKey, log: createMockLog() as never })

    expect(onNewMessage).not.toHaveBeenCalled()
    // historyId should still be updated
    expect(redis.set).toHaveBeenCalledWith(historyIdKey, '1001')
  })
})
