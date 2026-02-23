import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'
import type { DailyPlan, ParseResult, Parent } from '../models/types'

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })

/**
 * Parse an inbound SMS message from a parent to determine intent and extract changes.
 */
export async function parseInboundMessage(
  parent: Parent,
  messageBody: string,
  currentPlan: DailyPlan | null,
): Promise<ParseResult> {
  // Handle simple commands first
  const normalized = messageBody.trim().toUpperCase()
  if (normalized === 'OK' || normalized === '👍' || normalized === 'CONFIRM') {
    return { intent: 'CONFIRM', changes: [], clarificationNeeded: null }
  }
  if (normalized === 'DETAILS') {
    return {
      intent: 'COMMAND',
      changes: [],
      clarificationNeeded: null,
      commandType: 'DETAILS',
    }
  }
  if (normalized === 'WEEK') {
    return { intent: 'COMMAND', changes: [], clarificationNeeded: null, commandType: 'WEEK' }
  }
  if (normalized === 'TOMORROW') {
    return {
      intent: 'COMMAND',
      changes: [],
      clarificationNeeded: null,
      commandType: 'TOMORROW',
    }
  }
  if (normalized === 'HELP') {
    return { intent: 'COMMAND', changes: [], clarificationNeeded: null, commandType: 'HELP' }
  }

  // Check if it's a conflict resolution number
  if (/^[1-4]$/.test(normalized) && currentPlan && currentPlan.conflicts.length > 0) {
    const optionIndex = parseInt(normalized) - 1
    // Find the first unresolved conflict with enough options
    const conflict = currentPlan.conflicts[0]
    if (conflict && optionIndex < conflict.suggestedResolutions.length) {
      return {
        intent: 'RESOLVE_CONFLICT',
        changes: [
          {
            type: 'resolve_conflict',
            conflictIndex: 0,
            details: conflict.suggestedResolutions[optionIndex],
          },
        ],
        clarificationNeeded: null,
      }
    }
  }

  // For more complex messages, use Claude to parse intent
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are parsing an SMS from ${parent.name} about their co-parenting logistics plan.

Current plan for ${currentPlan?.date || 'today'}:
${currentPlan ? JSON.stringify(currentPlan, null, 2) : 'No plan generated yet.'}

Their message: "${messageBody}"

Determine the intent and extract structured changes. Possible intents:
- CONFIRM: parent is confirming the plan as-is
- CHANGE_TRANSPORT: changing who drives / picks up
- VOLUNTEER: parent is offering to handle something ("I can do the piano drop-off")
- QUESTION: asking about the plan
- SCHEDULE_CHANGE: an activity is cancelled, moved, or new
- RESOLVE_CONFLICT: picking one of the suggested options for a flagged conflict
- OTHER: doesn't fit above categories

Return ONLY valid JSON with this structure:
{
  "intent": "INTENT_TYPE",
  "changes": [
    {
      "type": "assign_transport" | "cancel_event" | "reschedule_event" | "add_note" | "resolve_conflict",
      "eventIndex": <number if applicable>,
      "conflictIndex": <number if applicable>,
      "parentId": "<parent id if applicable>",
      "details": "<description of the change>"
    }
  ],
  "clarificationNeeded": "<question to ask if something is unclear, or null>"
}`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) {
    return { intent: 'OTHER', changes: [], clarificationNeeded: 'Could not parse your message.' }
  }

  try {
    // Extract JSON from response (Claude sometimes wraps in markdown)
    const jsonStr = textBlock.text.replace(/```json?\n?/g, '').replace(/```/g, '')
    return JSON.parse(jsonStr.trim()) as ParseResult
  } catch {
    return {
      intent: 'OTHER',
      changes: [],
      clarificationNeeded: "I didn't understand that. Try again or text HELP for commands.",
    }
  }
}
