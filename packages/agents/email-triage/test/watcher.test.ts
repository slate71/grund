import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GmailWatcher } from '../src/gmail/watcher'
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
    watch: vi.fn().mockResolvedValue({ historyId: '2000', expiration: '1710100000000' }),
  } as unknown as GmailClient
}

describe('GmailWatcher', () => {
  let redis: RedisClient
  let gmail: ReturnType<typeof createMockGmail>
  let onNewMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    redis = createMockRedis()
    gmail = createMockGmail()
    onNewMessage = vi.fn().mockResolvedValue(undefined)
  })

  it('registers watch on start', async () => {
    const watcher = new GmailWatcher({
      gmail,
      redis,
      topicName: 'projects/test/topics/gmail-notifications',
      onNewMessage,
      log: createMockLog() as never,
    })
    await watcher.start()
    watcher.stop()

    expect(gmail.watch).toHaveBeenCalledWith('projects/test/topics/gmail-notifications')
  })

  it('initializes historyId from watch response when none stored', async () => {
    const watcher = new GmailWatcher({
      gmail,
      redis,
      topicName: 'projects/test/topics/gmail-notifications',
      onNewMessage,
      log: createMockLog() as never,
    })
    await watcher.start()
    watcher.stop()

    expect(redis.set).toHaveBeenCalledWith('email-triage:test:historyId', '2000')
  })

  it('preserves existing historyId on watch registration', async () => {
    await redis.set('email-triage:test:historyId', '1500')

    const watcher = new GmailWatcher({
      gmail,
      redis,
      topicName: 'projects/test/topics/gmail-notifications',
      onNewMessage,
      log: createMockLog() as never,
    })
    await watcher.start()
    watcher.stop()

    // Should not overwrite with watch response historyId
    expect(redis.set).not.toHaveBeenCalledWith('email-triage:test:historyId', '2000')
  })

  it('processes history on notification', async () => {
    await redis.set('email-triage:test:historyId', '999')
    ;(gmail.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyId: '1001',
      history: [
        { id: '1000', messagesAdded: [{ message: { id: 'msg-1', threadId: 't-1' } }] },
      ],
    })

    const watcher = new GmailWatcher({
      gmail,
      redis,
      topicName: 'projects/test/topics/gmail-notifications',
      onNewMessage,
      log: createMockLog() as never,
    })
    await watcher.start()
    await watcher.handleNotification()
    watcher.stop()

    expect(gmail.listHistory).toHaveBeenCalledWith('999')
    expect(onNewMessage).toHaveBeenCalledTimes(1)
  })

  it('handles watch registration failure gracefully', async () => {
    ;(gmail.watch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('watch failed: 403'),
    )

    const watcher = new GmailWatcher({
      gmail,
      redis,
      topicName: 'projects/test/topics/gmail-notifications',
      onNewMessage,
      log: createMockLog() as never,
    })

    // Should not throw
    await watcher.start()
    watcher.stop()
  })
})
