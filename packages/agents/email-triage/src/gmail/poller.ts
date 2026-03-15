import { GmailClient } from './client'
import { processHistory } from './history'
import type { ParsedEmail } from './types'

export interface RedisClient {
  connect(): Promise<unknown>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  publish(channel: string, message: string): Promise<number>
  isReady: boolean
  on(event: string, listener: (...args: unknown[]) => void): void
}

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
  private historyIdKey: string
  private timer: ReturnType<typeof setInterval> | null = null
  private polling = false

  constructor(opts: PollerOptions) {
    this.gmail = opts.gmail
    this.redis = opts.redis
    this.onNewMessage = opts.onNewMessage
    this.pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS
    this.historyIdKey = `email-triage:${this.gmail.account}:historyId`
  }

  async start(): Promise<void> {
    const stored = await this.redis.get(this.historyIdKey)
    if (!stored) {
      const profile = await this.gmail.getProfile()
      await this.redis.set(this.historyIdKey, profile.historyId)
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
      await processHistory({
        gmail: this.gmail,
        redis: this.redis,
        onNewMessage: this.onNewMessage,
        historyIdKey: this.historyIdKey,
      })
    } catch (err) {
      console.error('Poll error:', err)
    } finally {
      this.polling = false
    }
  }
}
