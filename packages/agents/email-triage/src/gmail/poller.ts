import { GmailClient } from './client'
import { processHistory } from './history'
import type { ParsedEmail } from './types'
import type { Logger } from '@grund/logger'

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
  log: Logger
}

export class GmailPoller {
  private gmail: GmailClient
  private redis: RedisClient
  private onNewMessage: (email: ParsedEmail) => Promise<void>
  private pollIntervalMs: number
  private historyIdKey: string
  private timer: ReturnType<typeof setInterval> | null = null
  private polling = false
  private log: Logger

  constructor(opts: PollerOptions) {
    this.gmail = opts.gmail
    this.redis = opts.redis
    this.onNewMessage = opts.onNewMessage
    this.pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS
    this.historyIdKey = `email-triage:${this.gmail.account}:historyId`
    this.log = opts.log
  }

  async start(): Promise<void> {
    const stored = await this.redis.get(this.historyIdKey)
    if (!stored) {
      const profile = await this.gmail.getProfile()
      await this.redis.set(this.historyIdKey, profile.historyId)
      this.log.info({ historyId: profile.historyId }, 'Initialized historyId')
    }

    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
    this.log.info({ intervalSecs: this.pollIntervalMs / 1000 }, 'Gmail poller started')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.log.info('Gmail poller stopped')
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
        log: this.log,
      })
    } catch (err) {
      this.log.error({ err }, 'Poll error')
    } finally {
      this.polling = false
    }
  }
}
