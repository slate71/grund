import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })

/**
 * Predict what a novel (unrecognized) calendar event might require.
 * Used when a calendar event doesn't match any known Activity patterns.
 */
export async function predictNovelEvent(
  eventTitle: string,
  date: string,
  time: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `A calendar event titled "${eventTitle}" appears on ${date} at ${time} for elementary school-aged children.
This is not a known recurring activity. What items, clothing, or preparation might be needed? What logistics questions should the parents consider?
Be concise and practical — 1-2 sentences max. Only flag non-obvious things. If it seems like a standard event that needs nothing special, say so briefly.`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text || 'Unknown event — check with the other parent.'
}
