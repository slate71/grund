import Anthropic from '@anthropic-ai/sdk'
import type { ClassificationResult, Message } from '@grund/shared'

const client = new Anthropic()

export async function classifyConversation(messages: Message[]): Promise<ClassificationResult> {
  const formatted = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are analyzing an AI agent conversation with a customer.

Classify the outcome:
- success: Customer got what they needed
- failure: Something went wrong (incorrect info, unresolved issue, customer frustration)
- escalation: Handed off to human
- unclear: Cannot determine from the conversation

Respond ONLY with valid JSON, no markdown fences:
{
  "outcome": "success" | "failure" | "escalation" | "unclear",
  "confidence": 0.0-1.0,
  "reason": "One sentence explanation",
  "signals": ["list", "of", "detected", "signals"]
}

Conversation:
${formatted}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ClassificationResult
}
