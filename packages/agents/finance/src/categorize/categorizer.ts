import type { CategorizableTransaction, CategoryDecision, SpendingCategory } from './types'
import { CATEGORIZE_SYSTEM_PROMPT, CATEGORIZE_TOOL_DEFINITION } from './prompt'

export interface CategorizerOptions {
  anthropicBaseUrl: string
  anthropicApiKey: string
}

// Categorize a single transaction by asking Claude (through the credential
// proxy) to pick one category. Mirrors the email-triage classifier: forced
// tool_use so the response is always structured.
export async function categorizeTransaction(
  txn: CategorizableTransaction,
  opts: CategorizerOptions,
): Promise<CategoryDecision> {
  const userMessage = [
    `Payee: ${txn.payee ?? '(unknown)'}`,
    `Description: ${txn.description ?? '(none)'}`,
    `Memo: ${txn.memo ?? '(none)'}`,
    `Amount: ${txn.amount}`,
  ].join('\n')

  const res = await fetch(`${opts.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      // Haiku is plenty for single-transaction classification, and ~5x cheaper
      // than Sonnet across a full statement import. Override via CATEGORIZE_MODEL.
      model: process.env.CATEGORIZE_MODEL || 'claude-haiku-4-5',
      max_tokens: 512,
      system: CATEGORIZE_SYSTEM_PROMPT,
      tools: [CATEGORIZE_TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'categorize_transaction' },
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
    throw new Error('No tool_use in categorization response')
  }

  const input = toolUse.input as {
    category: SpendingCategory
    confidence: number
    reason: string
  }

  return {
    category: input.category,
    confidence: input.confidence,
    reason: input.reason,
  }
}
