import { GmailClient, HistoryExpiredError, parseMessage } from './client'
import type { RedisClient } from './poller'
import type { ParsedEmail } from './types'

export interface ProcessHistoryOptions {
  gmail: GmailClient
  redis: RedisClient
  onNewMessage: (email: ParsedEmail) => Promise<void>
  historyIdKey: string
}

export async function processHistory(opts: ProcessHistoryOptions): Promise<void> {
  const { gmail, redis, onNewMessage, historyIdKey } = opts

  const historyId = await redis.get(historyIdKey)
  if (!historyId) {
    console.error('No historyId in Redis, re-initializing')
    const profile = await gmail.getProfile()
    await redis.set(historyIdKey, profile.historyId)
    return
  }

  try {
    const history = await gmail.listHistory(historyId)

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
        const msg = await gmail.getMessage(id)
        const parsed = parseMessage(msg)
        await onNewMessage(parsed)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('404')) {
          console.warn(`Message ${id} not found (likely a label change event), skipping`)
        } else {
          console.error(`Failed to process message ${id}:`, err)
        }
      }
    }

    await redis.set(historyIdKey, history.historyId)

    if (messageIds.size > 0) {
      console.log(`Processed ${messageIds.size} new message(s)`)
    }
  } catch (err) {
    if (err instanceof HistoryExpiredError) {
      console.warn('History expired, re-syncing from profile')
      const profile = await gmail.getProfile()
      await redis.set(historyIdKey, profile.historyId)
    } else {
      throw err
    }
  }
}
