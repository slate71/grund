import { GmailClient } from './client'
import { processHistory } from './history'
import type { RedisClient } from './poller'
import type { ParsedEmail } from './types'
import type { Logger } from '@grund/logger'

const WATCH_RENEWAL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface WatcherOptions {
  gmail: GmailClient
  redis: RedisClient
  topicName: string
  onNewMessage: (email: ParsedEmail) => Promise<void>
  log: Logger
}

export class GmailWatcher {
  private gmail: GmailClient
  private redis: RedisClient
  private topicName: string
  private onNewMessage: (email: ParsedEmail) => Promise<void>
  private historyIdKey: string
  private renewalTimer: ReturnType<typeof setInterval> | null = null
  private log: Logger

  constructor(opts: WatcherOptions) {
    this.gmail = opts.gmail
    this.redis = opts.redis
    this.topicName = opts.topicName
    this.onNewMessage = opts.onNewMessage
    this.historyIdKey = `email-triage:${this.gmail.account}:historyId`
    this.log = opts.log
  }

  async start(): Promise<void> {
    await this.registerWatch()
    this.renewalTimer = setInterval(() => this.registerWatch(), WATCH_RENEWAL_MS)
    this.log.info('Gmail watcher started (renews every 24h)')
  }

  stop(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer)
      this.renewalTimer = null
    }
    this.log.info('Gmail watcher stopped')
  }

  async handleNotification(): Promise<void> {
    await processHistory({
      gmail: this.gmail,
      redis: this.redis,
      onNewMessage: this.onNewMessage,
      historyIdKey: this.historyIdKey,
      log: this.log,
    })
  }

  private async registerWatch(): Promise<void> {
    try {
      const response = await this.gmail.watch(this.topicName)
      const stored = await this.redis.get(this.historyIdKey)
      if (!stored) {
        await this.redis.set(this.historyIdKey, response.historyId)
        this.log.info({ historyId: response.historyId }, 'Initialized historyId from watch')
      }
      const expiry = new Date(parseInt(response.expiration))
      this.log.info({ expires: expiry.toISOString() }, 'Watch registered')
    } catch (err) {
      this.log.error({ err }, 'Failed to register watch')
    }
  }
}
