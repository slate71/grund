import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { fetchAllEventsForDate } from '../calendar/google'
import { getCustodyParent, checkCustodySwitch, getAllParents } from './custody'
import { detectConflicts } from './conflicts'
import { formatPlanSMS, formatWeeklyLookahead } from '../ai/format'
import { predictNovelEvent } from '../ai/predict'
import { sendSMS } from '../sms/twilio'
import { todayPT, dateRange } from '../utils/time'
import type {
  DailyPlan,
  PlannedEvent,
  PlanFlag,
  Activity,
  CalendarEvent,
  Parent,
} from '../models/types'

/**
 * Generate and send the daily logistics plan.
 *
 * Flow:
 * 1. Pull calendar events for the target date
 * 2. Determine custody
 * 3. Match activities → build PlannedEvent list
 * 4. Assign transport (custody parent by default)
 * 5. Detect conflicts
 * 6. Flag novel events
 * 7. Format via Claude and send SMS to both parents
 */
export async function generateAndSendDailyPlan(date?: string): Promise<DailyPlan | null> {
  const targetDate = date || todayPT()
  console.log(`Generating daily plan for ${targetDate}...`)

  // 1. Determine custody
  const custodyParent = await getCustodyParent(targetDate)
  if (!custodyParent) {
    console.error(`Could not determine custody parent for ${targetDate}`)
    return null
  }

  const allParents = await getAllParents()
  const otherParent = allParents.find((p) => p.id !== custodyParent.id)

  // 2. Pull calendar events
  const { parent1Events, parent2Events } = await fetchAllEventsForDate(targetDate)

  // Determine which events belong to the custody parent
  const custodyParentEvents =
    custodyParent.calendarId === allParents[0]?.calendarId ? parent1Events : parent2Events
  const otherParentEvents =
    custodyParent.calendarId === allParents[0]?.calendarId ? parent2Events : parent1Events

  // 3. Load activities from DB
  const activities = await db.select().from(schema.activities)

  // 4. Build planned events from calendar data
  // Combine all events (both parents' calendars may have kid activities)
  const allCalendarEvents = [...parent1Events, ...parent2Events]
  const kidEvents = matchAndBuildEvents(allCalendarEvents, activities, custodyParent.id)

  // 5. Check custody switch
  const { switching: isCustodySwitchDay } = await checkCustodySwitch(targetDate)

  // 6. Detect conflicts
  const conflicts = detectConflicts(
    kidEvents,
    custodyParent.id,
    custodyParentEvents,
    isCustodySwitchDay,
  )

  // 7. Flag novel events and custody switch
  const flags: PlanFlag[] = []

  if (isCustodySwitchDay) {
    flags.push({
      type: 'custody_switch_today',
      message: `Custody switches to ${custodyParent.homeLabel} today.`,
      requiresResponse: false,
    })
  }

  // Check for novel events (ones that don't match any known activity)
  const novelEvents = allCalendarEvents.filter(
    (ce) => !activities.some((a) => matchesActivity(ce.title, a.matchPatterns)),
  )

  // Filter out events that are clearly parent-only (from parent calendars, not kid activities)
  // For now, flag all novel events from kid-related calendars
  for (const event of novelEvents) {
    try {
      const prediction = await predictNovelEvent(event.title, targetDate, event.startTime)
      flags.push({
        type: 'novel_event',
        message: `New event: "${event.title}" — ${prediction}`,
        requiresResponse: true,
      })
    } catch (err) {
      flags.push({
        type: 'novel_event',
        message: `New event: "${event.title}" at ${event.startTime} — not a known activity.`,
        requiresResponse: true,
      })
    }
  }

  // 8. Save plan to database
  const plan: DailyPlan = {
    id: '', // will be set by DB
    date: targetDate,
    custodyParentId: custodyParent.id,
    events: kidEvents,
    conflicts,
    flags,
    status: 'draft',
    confirmedBy: [],
    version: 1,
    generatedAt: new Date(),
    lastModifiedAt: new Date(),
  }

  const [savedPlan] = await db
    .insert(schema.dailyPlans)
    .values({
      date: plan.date,
      custodyParentId: plan.custodyParentId,
      events: plan.events,
      conflicts: plan.conflicts,
      flags: plan.flags,
      status: 'draft',
      confirmedBy: [],
      version: 1,
    })
    .returning()

  plan.id = savedPlan.id

  // 9. Format and send SMS
  try {
    const smsText = await formatPlanSMS(plan, custodyParent, allParents)

    // Send to both parents
    for (const parent of allParents) {
      await sendSMS(parent.phone, smsText)
      // Log outbound message
      await db.insert(schema.messageLogs).values({
        parentId: parent.id,
        direction: 'outbound',
        body: smsText,
      })
    }

    // Update plan status
    await db
      .update(schema.dailyPlans)
      .set({ status: 'sent' })
      .where(eq(schema.dailyPlans.id, plan.id))

    plan.status = 'sent'
    console.log(`Daily plan sent to ${allParents.length} parents for ${targetDate}`)
  } catch (err) {
    console.error('Failed to send daily plan SMS:', err)
    // Fallback: try to send a raw plan
    try {
      const fallbackText = formatFallbackPlan(plan, custodyParent)
      for (const parent of allParents) {
        await sendSMS(parent.phone, fallbackText)
      }
    } catch (fallbackErr) {
      console.error('Fallback SMS also failed:', fallbackErr)
    }
  }

  return plan
}

/**
 * Generate and send the weekly lookahead (Sunday evening).
 */
export async function generateAndSendWeeklyLookahead(): Promise<void> {
  const today = todayPT()
  // Get next Monday
  const todayDate = new Date(today + 'T12:00:00')
  const dayOfWeek = todayDate.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const monday = new Date(todayDate)
  monday.setDate(monday.getDate() + daysUntilMonday)
  const mondayStr = monday.toISOString().split('T')[0]

  const weekDates = dateRange(mondayStr, 7)
  const allParents = await getAllParents()
  const activities = await db.select().from(schema.activities)

  const weekSummary: Array<{
    date: string
    custodyParent: Parent | null
    events: PlannedEvent[]
    hasConflicts: boolean
  }> = []

  for (const date of weekDates) {
    const custodyParent = await getCustodyParent(date)
    const { parent1Events, parent2Events } = await fetchAllEventsForDate(date)
    const allCalendarEvents = [...parent1Events, ...parent2Events]
    const kidEvents = matchAndBuildEvents(
      allCalendarEvents,
      activities,
      custodyParent?.id || allParents[0]?.id || '',
    )

    const custodyParentEvents =
      custodyParent?.calendarId === allParents[0]?.calendarId ? parent1Events : parent2Events
    const { switching } = await checkCustodySwitch(date)
    const conflicts = detectConflicts(
      kidEvents,
      custodyParent?.id || '',
      custodyParentEvents,
      switching,
    )

    weekSummary.push({
      date,
      custodyParent,
      events: kidEvents,
      hasConflicts: conflicts.length > 0,
    })
  }

  try {
    const smsText = await formatWeeklyLookahead(weekSummary, allParents)

    for (const parent of allParents) {
      await sendSMS(parent.phone, smsText)
      await db.insert(schema.messageLogs).values({
        parentId: parent.id,
        direction: 'outbound',
        body: smsText,
      })
    }

    console.log('Weekly lookahead sent')
  } catch (err) {
    console.error('Failed to send weekly lookahead:', err)
  }
}

// --- Internal Helpers ---

/**
 * Match calendar events against known activities and build PlannedEvent objects.
 * Custody parent is assigned as default driver.
 */
function matchAndBuildEvents(
  calendarEvents: CalendarEvent[],
  activities: Activity[],
  custodyParentId: string,
): PlannedEvent[] {
  const planned: PlannedEvent[] = []
  const seenEventIds = new Set<string>()

  for (const calEvent of calendarEvents) {
    // Deduplicate (same event might appear on multiple calendars)
    if (seenEventIds.has(calEvent.id)) continue
    seenEventIds.add(calEvent.id)

    const matchedActivity = activities.find((a) => matchesActivity(calEvent.title, a.matchPatterns))

    if (matchedActivity) {
      planned.push({
        calendarEventId: calEvent.id,
        title: `${matchedActivity.name}${matchedActivity.childIds.length === 1 ? '' : ''}`,
        startTime: calEvent.startTime,
        endTime: calEvent.endTime,
        location: calEvent.location || matchedActivity.defaultLocation,
        childIds: matchedActivity.childIds,
        itemsNeeded: matchedActivity.requiredItems,
        transportParentId: custodyParentId,
        notes: '',
      })
    }
    // Novel events are handled separately in generateAndSendDailyPlan
  }

  // Sort by start time
  planned.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return planned
}

/** Check if a calendar event title matches any of the activity's patterns */
function matchesActivity(title: string, patterns: string[]): boolean {
  const normalizedTitle = title.toLowerCase().trim()
  return patterns.some((pattern) => normalizedTitle.includes(pattern.toLowerCase()))
}

/** Fallback plan formatter when Claude API is unavailable */
function formatFallbackPlan(plan: DailyPlan, custodyParent: Parent): string {
  let text = `Plan for ${plan.date} — Kids with ${custodyParent.name}\n\n`

  for (const event of plan.events) {
    text += `${event.title} ${event.startTime}\n`
    if (event.location) text += `  at ${event.location}\n`
    if (event.itemsNeeded.length) text += `  Needs: ${event.itemsNeeded.join(', ')}\n`
    text += '\n'
  }

  if (plan.conflicts.length > 0) {
    text += `\n${plan.conflicts.length} CONFLICT(S) — reply for details.\n`
  }

  text += '\nReply OK to confirm or text changes.'
  return text
}

/** Get the current daily plan for a given date (most recent version) */
export async function getCurrentPlan(date: string): Promise<DailyPlan | null> {
  const results = await db
    .select()
    .from(schema.dailyPlans)
    .where(eq(schema.dailyPlans.date, date))
    .orderBy(schema.dailyPlans.version)
    .limit(1)

  if (results.length === 0) return null

  const row = results[0]
  return {
    id: row.id,
    date: row.date,
    custodyParentId: row.custodyParentId,
    events: row.events as PlannedEvent[],
    conflicts: row.conflicts as any[],
    flags: row.flags as any[],
    status: row.status as DailyPlan['status'],
    confirmedBy: row.confirmedBy as string[],
    version: row.version,
    generatedAt: row.generatedAt,
    lastModifiedAt: row.lastModifiedAt,
  }
}
