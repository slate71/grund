import { GmailClient } from './client'
import { processHistory } from './history'
import type { RedisClient } from './poller'
import type { ParsedEmail } from './types'

const WATCH_RENEWAL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface WatcherOptions {
  gmail: GmailClient
  redis: RedisClient
  topicName: string
  onNewMessage: (email: ParsedEmail) => Promise<void>
}

export class GmailWatcher {
  private gmail: GmailClient
  private redis: RedisClient
  private topicName: string
  private onNewMessage: (email: ParsedEmail) => Promise<void>
  private historyIdKey: string
  private renewalTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: WatcherOptions) {
    this.gmail = opts.gmail
    this.redis = opts.redis
    this.topicName = opts.topicName
    this.onNewMessage = opts.onNewMessage
    this.historyIdKey = `email-triage:${this.gmail.account}:historyId`
  }

  async start(): Promise<void> {
    await this.registerWatch()
    this.renewalTimer = setInterval(() => this.registerWatch(), WATCH_RENEWAL_MS)
    console.log(`Gmail watcher started for ${this.gmail.account} (renews every 24h)`)
  }

  stop(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer)
      this.renewalTimer = null
    }
    console.log(`Gmail watcher stopped for ${this.gmail.account}`)
  }

  async handleNotification(): Promise<void> {
    await processHistory({
      gmail: this.gmail,
      redis: this.redis,
      onNewMessage: this.onNewMessage,
      historyIdKey: this.historyIdKey,
    })
  }

  private async registerWatch(): Promise<void> {
    try {
      const response = await this.gmail.watch(this.topicName)
      const stored = await this.redis.get(this.historyIdKey)
      if (!stored) {
        await this.redis.set(this.historyIdKey, response.historyId)
        console.log(`Initialized historyId from watch: ${response.historyId}`)
      }
      const expiry = new Date(parseInt(response.expiration))
      console.log(`Watch registered for ${this.gmail.account}, expires ${expiry.toISOString()}`)
    } catch (err) {
      console.error(`Failed to register watch for ${this.gmail.account}:`, err)
    }
  }
}
