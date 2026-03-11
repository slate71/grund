import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GmailPoller, type RedisClient } from '../src/gmail/poller'
import type { GmailClient } from '../src/gmail/client'

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
    modifyMessage: vi.fn().mockResolvedValue(undefined),
    createDraft: vi.fn().mockResolvedValue('draft-1'),
    getOrCreateLabel: vi.fn().mockResolvedValue('label-1'),
  } as unknown as GmailClient
}

describe('GmailPoller', () => {
  let redis: RedisClient
  let gmail: ReturnType<typeof createMockGmail>
  let onNewMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    redis = createMockRedis()
    gmail = createMockGmail()
    onNewMessage = vi.fn().mockResolvedValue(undefined)
  })

  it('initializes historyId from Gmail profile on first start', async () => {
    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    poller.stop()

    expect(gmail.getProfile).toHaveBeenCalled()
    expect(redis.set).toHaveBeenCalledWith('email-triage:historyId', '1000')
  })

  it('skips profile fetch if historyId already in Redis', async () => {
    await redis.set('email-triage:historyId', '999')

    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    poller.stop()

    expect(gmail.getProfile).not.toHaveBeenCalled()
  })

  it('calls onNewMessage for each new message in history', async () => {
    await redis.set('email-triage:historyId', '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
        { id: '1001', messagesAdded: [{ message: { id: 'msg-2', threadId: 't-2' } }] },
      ],
    })

    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    await poller.poll()
    poller.stop()

    expect(onNewMessage).toHaveBeenCalledTimes(2)
  })

  it('deduplicates message IDs across history entries', async () => {
    await redis.set('email-triage:historyId', '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
        { id: '1001', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
      ],
    })

    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    await poller.poll()
    poller.stop()

    expect(onNewMessage).toHaveBeenCalledTimes(1)
  })

  it('updates historyId in Redis after poll', async () => {
    await redis.set('email-triage:historyId', '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1005',
      history: [],
    })

    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    await poller.poll()
    poller.stop()

    expect(redis.set).toHaveBeenCalledWith('email-triage:historyId', '1005')
  })

  it('handles history expired (410) by re-syncing', async () => {
    await redis.set('email-triage:historyId', '999')

    const { HistoryExpiredError } = await import('../src/gmail/client')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HistoryExpiredError('expired'),
    )

    const poller = new GmailPoller({ gmail, redis, onNewMessage, pollIntervalMs: 100_000 })
    await poller.start()
    await poller.poll()
    poller.stop()

    // Should have fetched profile to get new historyId
    expect(gmail.getProfile).toHaveBeenCalledTimes(1)
  })
})
