import type { GmailClient } from '../gmail/client'
import type { ParsedEmail } from '../gmail/types'
import type { TriageDecision } from './types'
import { CATEGORY_ACTIONS } from './types'
import { generateDraftReply } from './classifier'
import type { Logger } from '@grund/logger'

// Cache label name → ID mappings
const labelCache = new Map<string, string>()

export interface ActionContext {
  gmail: GmailClient
  anthropicBaseUrl: string
  anthropicApiKey: string
  log: Logger
}

export async function executeActions(
  email: ParsedEmail,
  decision: TriageDecision,
  ctx: ActionContext,
): Promise<{ labelsApplied: string[]; archived: boolean; draftCreated: boolean }> {
  const labelsApplied: string[] = []
  let archived = false
  let draftCreated = false

  // Use predefined labels from CATEGORY_ACTIONS, ignore classifier suggestions
  const actions = CATEGORY_ACTIONS[decision.category]
  const labelIds: string[] = []
  for (const labelName of actions.labels) {
    try {
      let labelId = labelCache.get(labelName)
      if (!labelId) {
        labelId = await ctx.gmail.getOrCreateLabel(labelName)
        labelCache.set(labelName, labelId)
      }
      labelIds.push(labelId)
      labelsApplied.push(labelName)
    } catch (err) {
      ctx.log.error({ err, label: labelName }, 'Failed to resolve label')
    }
  }

  // Archive = remove INBOX label
  const removeLabelIds: string[] = []
  if (actions.archive) {
    removeLabelIds.push('INBOX')
    archived = true
  }

  if (labelIds.length > 0 || removeLabelIds.length > 0) {
    await ctx.gmail.modifyMessage(email.messageId, labelIds, removeLabelIds)
  }

  // Draft reply
  if (actions.draft) {
    try {
      const replyBody = await generateDraftReply(email, {
        anthropicBaseUrl: ctx.anthropicBaseUrl,
        anthropicApiKey: ctx.anthropicApiKey,
      })
      if (replyBody) {
        await ctx.gmail.createDraft(email.from, email.subject, replyBody, email.threadId)
        draftCreated = true
      }
    } catch (err) {
      ctx.log.error({ err, messageId: email.messageId }, 'Failed to create draft')
    }
  }

  return { labelsApplied, archived, draftCreated }
}
