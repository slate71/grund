import type { ParsedEmail } from '../gmail/types'
import type { TriageDecision, TriageCategory } from './types'
import { CATEGORY_ACTIONS } from './types'
import { TRIAGE_SYSTEM_PROMPT, TRIAGE_TOOL_DEFINITION, DRAFT_REPLY_SYSTEM_PROMPT } from './prompt'
import { matchNewsletter, type NewsletterConfig } from '../config/newsletters'

export interface ClassifierOptions {
  anthropicBaseUrl: string
  anthropicApiKey: string
  newsletterConfig: NewsletterConfig
}

export async function classifyEmail(
  email: ParsedEmail,
  opts: ClassifierOptions,
): Promise<TriageDecision> {
  // Deterministic newsletter match first — no API call needed
  const newsletterMatch = matchNewsletter(email.from, email.subject, opts.newsletterConfig)
  if (newsletterMatch) {
    const actions = CATEGORY_ACTIONS[newsletterMatch]
    return {
      category: newsletterMatch,
      confidence: 1.0,
      reason: 'Matched newsletter seed list',
      shouldDraftReply: actions.draft,
      suggestedLabels: actions.labels,
      archiveAfter: actions.archive,
    }
  }

  // Call Claude for classification
  const userMessage = [
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    `Date: ${email.date}`,
    '',
    email.body.slice(0, 4000),
  ].join('\n')

  const res = await fetch(`${opts.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: TRIAGE_SYSTEM_PROMPT,
      tools: [TRIAGE_TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'classify_email' },
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    content: { type: string; name?: string; input?: Record<string, unknown> }[]
  }

  const toolUse = data.content.find((c) => c.type === 'tool_use')
  if (!toolUse?.input) {
    throw new Error('No tool_use in classification response')
  }

  const input = toolUse.input as {
    category: TriageCategory
    confidence: number
    reason: string
    shouldDraftReply: boolean
    suggestedLabels: string[]
    archiveAfter: boolean
  }

  return {
    category: input.category,
    confidence: input.confidence,
    reason: input.reason,
    shouldDraftReply: input.shouldDraftReply,
    suggestedLabels: input.suggestedLabels,
    archiveAfter: input.archiveAfter,
  }
}

export async function generateDraftReply(
  email: ParsedEmail,
  opts: { anthropicBaseUrl: string; anthropicApiKey: string },
): Promise<string> {
  const userMessage = [
    `Original email:`,
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    '',
    email.body.slice(0, 4000),
    '',
    'Write a brief reply draft.',
  ].join('\n')

  const res = await fetch(`${opts.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: DRAFT_REPLY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[]
  }

  const text = data.content.find((c) => c.type === 'text')
  return text?.text ?? ''
}
