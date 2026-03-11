import { GmailClient, HistoryExpiredError, parseMessage } from './client'
import type { ParsedEmail } from './types'

export interface RedisClient {
  connect(): Promise<unknown>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  publish(channel: string, message: string): Promise<number>
  isReady: boolean
  on(event: string, listener: (...args: unknown[]) => void): void
}

const HISTORY_ID_KEY = 'email-triage:historyId'
const POLL_INTERVAL_MS = 15_000

export interface PollerOptions {
  gmail: GmailClient
  redis: RedisClient
  onNewMessage: (email: ParsedEmail) => Promise<void>
  pollIntervalMs?: number
}

export class GmailPoller {
  private gmail: GmailClient
  private redis: RedisClient
  private onNewMessage: (email: ParsedEmail) => Promise<void>
  private pollIntervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private polling = false

  constructor(opts: PollerOptions) {
    this.gmail = opts.gmail
    this.redis = opts.redis
    this.onNewMessage = opts.onNewMessage
    this.pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS
  }

  async start(): Promise<void> {
    const stored = await this.redis.get(HISTORY_ID_KEY)
    if (!stored) {
      const profile = await this.gmail.getProfile()
      await this.redis.set(HISTORY_ID_KEY, profile.historyId)
      console.log(`Initialized historyId: ${profile.historyId}`)
    }

    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
    console.log(`Gmail poller started (every ${this.pollIntervalMs / 1000}s)`)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    console.log('Gmail poller stopped')
  }

  async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true

    try {
      const historyId = await this.redis.get(HISTORY_ID_KEY)
      if (!historyId) {
        console.error('No historyId in Redis, re-initializing')
        const profile = await this.gmail.getProfile()
        await this.redis.set(HISTORY_ID_KEY, profile.historyId)
        this.polling = false
        return
      }

      const history = await this.gmail.listHistory(historyId)

      const messageIds = new Set<string>()
      if (history.history) {
        for (const entry of history.history) {
          if (entry.messagesAdded) {
            for (const added of entry.messagesAdded) {
              messageIds.add(added.message.id)
            }
          }
        }
      }

      for (const id of messageIds) {
        try {
          const msg = await this.gmail.getMessage(id)
          const parsed = parseMessage(msg)
          await this.onNewMessage(parsed)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes('404')) {
            console.warn(`Message ${id} not found (likely a label change event), skipping`)
          } else {
            console.error(`Failed to process message ${id}:`, err)
          }
        }
      }

      await this.redis.set(HISTORY_ID_KEY, history.historyId)

      if (messageIds.size > 0) {
        console.log(`Processed ${messageIds.size} new message(s)`)
      }
    } catch (err) {
      if (err instanceof HistoryExpiredError) {
        console.warn('History expired, re-syncing from profile')
        const profile = await this.gmail.getProfile()
        await this.redis.set(HISTORY_ID_KEY, profile.historyId)
      } else {
        console.error('Poll error:', err)
      }
    } finally {
      this.polling = false
    }
  }
}
