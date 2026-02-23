import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'
import { formatDateShort, formatTimeRange } from '../utils/time'
import type { DailyPlan, Parent, PlannedEvent } from '../models/types'

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })

/**
 * Format a daily plan as an SMS message using Claude.
 * Falls back to a structured template if Claude is unavailable.
 */
export async function formatPlanSMS(
  plan: DailyPlan,
  custodyParent: Parent,
  allParents: Parent[],
): Promise<string> {
  const parentNames = new Map(allParents.map((p) => [p.id, p.name]))

  const planContext = {
    date: plan.date,
    dateFormatted: formatDateShort(plan.date),
    custodyParent: custodyParent.name,
    custodyHomeLabel: custodyParent.homeLabel,
    events: plan.events.map((e) => ({
      ...e,
      timeRange: formatTimeRange(e.startTime, e.endTime),
      transportParent: e.transportParentId ? parentNames.get(e.transportParentId) : 'unassigned',
    })),
    conflicts: plan.conflicts,
    flags: plan.flags,
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are formatting a co-parenting daily logistics plan as an SMS message.

Here is the plan data:
${JSON.stringify(planContext, null, 2)}

Format this as a concise, scannable SMS using this structure:
- Header line with emoji, day/date, and custody info
- Each event with emoji, time range, location, needed items, and driver
- Any conflicts with warning emoji and numbered resolution options
- Any flags/notes
- End with "Reply OK to confirm or text changes."

Keep it under 480 characters when there are no conflicts. Use emoji sparingly for visual scanning.
Use these emoji conventions: 📋 plan header, 🏈⚽🏊🎹 for sports/activities, 📍 location, 👟 needed items, 🚗 transport, ⚠️ conflicts.

Return ONLY the SMS text, no markdown or explanation.`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text || formatPlanTemplate(plan, custodyParent, parentNames)
}

/**
 * Format a weekly lookahead SMS using Claude.
 */
export async function formatWeeklyLookahead(
  weekSummary: Array<{
    date: string
    custodyParent: Parent | null
    events: PlannedEvent[]
    hasConflicts: boolean
  }>,
  allParents: Parent[],
): Promise<string> {
  const summaryData = weekSummary.map((day) => ({
    date: day.date,
    dateFormatted: formatDateShort(day.date),
    custodyParent: day.custodyParent?.name || 'Unknown',
    eventCount: day.events.length,
    eventNames: day.events.map((e) => e.title),
    hasConflicts: day.hasConflicts,
  }))

  const startDate = formatDateShort(weekSummary[0].date)
  const endDate = formatDateShort(weekSummary[weekSummary.length - 1].date)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Format a weekly co-parenting lookahead SMS.

Week of ${startDate} - ${endDate}:
${JSON.stringify(summaryData, null, 2)}

Format as a compact weekly overview:
- 📅 header with date range
- One line per day: day name, activities summary, custody parent, ⚠️ if conflicts
- Count of items needing attention
- End with "Reply DETAILS for full breakdown."

Keep concise. Return ONLY the SMS text.`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text || formatWeeklyTemplate(weekSummary)
}

// --- Template fallbacks ---

function formatPlanTemplate(
  plan: DailyPlan,
  custodyParent: Parent,
  parentNames: Map<string, string>,
): string {
  let text = `📋 ${formatDateShort(plan.date)} — Kids with ${custodyParent.name}\n\n`

  for (const event of plan.events) {
    text += `${event.title} ${formatTimeRange(event.startTime, event.endTime)}\n`
    if (event.location) text += `   📍 ${event.location}\n`
    if (event.itemsNeeded.length) text += `   👟 Needs: ${event.itemsNeeded.join(', ')}\n`
    const driver = event.transportParentId ? parentNames.get(event.transportParentId) : null
    if (driver) text += `   🚗 ${driver} drives\n`
    text += '\n'
  }

  if (plan.conflicts.length > 0) {
    for (const conflict of plan.conflicts) {
      text += `⚠️ ${conflict.description}\n`
      conflict.suggestedResolutions.forEach((r, i) => {
        text += `${i + 1}️⃣ ${r}\n`
      })
      text += '\n'
    }
  }

  for (const flag of plan.flags) {
    text += `${flag.type === 'custody_switch_today' ? '🔄' : 'ℹ️'} ${flag.message}\n`
  }

  text += '\nReply OK to confirm or text changes.'
  return text
}

function formatWeeklyTemplate(
  weekSummary: Array<{
    date: string
    custodyParent: Parent | null
    events: PlannedEvent[]
    hasConflicts: boolean
  }>,
): string {
  const startDate = formatDateShort(weekSummary[0].date)
  const endDate = formatDateShort(weekSummary[weekSummary.length - 1].date)

  let text = `📅 Week of ${startDate}-${endDate}\n\n`

  let attentionItems = 0
  for (const day of weekSummary) {
    const dayStr = formatDateShort(day.date)
    const activities =
      day.events.length > 0 ? day.events.map((e) => e.title).join(' + ') : 'No activities'
    const parent = day.custodyParent?.name || '?'
    const warning = day.hasConflicts ? ' ⚠️' : ''
    text += `${dayStr}: ${activities} — ${parent}${warning}\n`
    if (day.hasConflicts) attentionItems++
  }

  if (attentionItems > 0) {
    text += `\n⚠️ ${attentionItems} item(s) need attention\n`
  }

  text += '\nReply DETAILS for full breakdown.'
  return text
}
