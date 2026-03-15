import { GmailClient, HistoryExpiredError, parseMessage } from './client'
import type { RedisClient } from './poller'
import type { ParsedEmail } from './types'
import type { Logger } from '@grund/logger'

export interface ProcessHistoryOptions {
  gmail: GmailClient
  redis: RedisClient
  onNewMessage: (email: ParsedEmail) => Promise<void>
  historyIdKey: string
  log: Logger
}

export async function processHistory(opts: ProcessHistoryOptions): Promise<void> {
  const { gmail, redis, onNewMessage, historyIdKey, log } = opts

  const historyId = await redis.get(historyIdKey)
  if (!historyId) {
    log.error('No historyId in Redis, re-initializing')
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
          log.warn({ messageId: id }, 'Message not found (likely a label change event), skipping')
        } else {
          log.error({ err, messageId: id }, 'Failed to process message')
        }
      }
    }

    await redis.set(historyIdKey, history.historyId)

    if (messageIds.size > 0) {
      log.info({ count: messageIds.size }, 'Processed new messages')
    }
  } catch (err) {
    if (err instanceof HistoryExpiredError) {
      log.warn('History expired, re-syncing from profile')
      const profile = await gmail.getProfile()
      await redis.set(historyIdKey, profile.historyId)
    } else {
      throw err
    }
  }
}
