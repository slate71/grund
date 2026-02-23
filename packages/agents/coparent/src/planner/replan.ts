import { eq } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { formatPlanSMS } from '../ai/format'
import { sendSMS } from '../sms/twilio'
import { getAllParents } from './custody'
import type { DailyPlan, ParseResult, PlannedEvent, Parent } from '../models/types'

/**
 * Apply parsed changes to a plan, recompute conflicts, and broadcast updates.
 *
 * This is the reactive replanning engine — when a parent texts a change,
 * we apply it, check for downstream effects, and notify both parents.
 */
export async function applyChangesAndReplan(
  plan: DailyPlan,
  parseResult: ParseResult,
  respondingParent: Parent,
): Promise<DailyPlan> {
  const allParents = await getAllParents()
  const otherParent = allParents.find((p) => p.id !== respondingParent.id)
  let updated = { ...plan }

  for (const change of parseResult.changes) {
    switch (change.type) {
      case 'assign_transport': {
        if (change.eventIndex !== undefined && change.parentId) {
          const events = [...updated.events]
          if (events[change.eventIndex]) {
            events[change.eventIndex] = {
              ...events[change.eventIndex],
              transportParentId: change.parentId,
            }
            updated.events = events
          }
        }
        break
      }

      case 'cancel_event': {
        if (change.eventIndex !== undefined) {
          const events = [...updated.events]
          events.splice(change.eventIndex, 1)
          updated.events = events
        }
        break
      }

      case 'resolve_conflict': {
        if (change.conflictIndex !== undefined) {
          const conflicts = [...updated.conflicts]
          // Remove the resolved conflict
          conflicts.splice(change.conflictIndex, 1)
          updated.conflicts = conflicts

          // Apply the resolution — this may involve transport reassignment
          updated = applyResolution(updated, change.details, respondingParent, otherParent)
        }
        break
      }

      case 'add_note': {
        if (change.eventIndex !== undefined) {
          const events = [...updated.events]
          if (events[change.eventIndex]) {
            events[change.eventIndex] = {
              ...events[change.eventIndex],
              notes: change.details,
            }
            updated.events = events
          }
        }
        break
      }

      case 'reschedule_event': {
        // Reschedule is more complex — for now, add a note
        if (change.eventIndex !== undefined) {
          const events = [...updated.events]
          if (events[change.eventIndex]) {
            events[change.eventIndex] = {
              ...events[change.eventIndex],
              notes: `Rescheduled: ${change.details}`,
            }
            updated.events = events
          }
        }
        break
      }
    }
  }

  // Recheck for transport gaps after changes
  updated.conflicts = recomputeTransportConflicts(updated)

  // Version bump
  updated.version += 1
  updated.status = 'modified'
  updated.lastModifiedAt = new Date()

  // Save updated plan
  await db
    .update(schema.dailyPlans)
    .set({
      events: updated.events,
      conflicts: updated.conflicts,
      flags: updated.flags,
      status: 'modified',
      version: updated.version,
      lastModifiedAt: updated.lastModifiedAt,
    })
    .where(eq(schema.dailyPlans.id, updated.id))

  // Format and broadcast to both parents
  const custodyParent = allParents.find((p) => p.id === updated.custodyParentId) || allParents[0]
  const changeDescription = parseResult.changes.map((c) => c.details).join('; ')

  try {
    const smsText = await formatChangeSMS(updated, custodyParent, allParents, changeDescription)

    for (const parent of allParents) {
      await sendSMS(parent.phone, smsText)
      await db.insert(schema.messageLogs).values({
        parentId: parent.id,
        direction: 'outbound',
        body: smsText,
      })
    }
  } catch (err) {
    console.error('Failed to send updated plan SMS:', err)
  }

  return updated
}

/**
 * Handle a plan confirmation from a parent.
 */
export async function confirmPlan(plan: DailyPlan, parentId: string): Promise<DailyPlan> {
  const confirmedBy = [...new Set([...plan.confirmedBy, parentId])]
  const allParents = await getAllParents()
  const bothConfirmed = confirmedBy.length >= allParents.length

  const newStatus = bothConfirmed ? 'confirmed_both' : 'confirmed_one'

  await db
    .update(schema.dailyPlans)
    .set({
      confirmedBy,
      status: newStatus,
    })
    .where(eq(schema.dailyPlans.id, plan.id))

  return {
    ...plan,
    confirmedBy,
    status: newStatus as DailyPlan['status'],
  }
}

// --- Internal Helpers ---

/** Try to apply a conflict resolution by parsing the resolution text */
function applyResolution(
  plan: DailyPlan,
  resolution: string,
  respondingParent: Parent,
  otherParent: Parent | undefined,
): DailyPlan {
  const lower = resolution.toLowerCase()
  const updated = { ...plan }

  // Check if the resolution involves the other parent handling something
  if (otherParent && (lower.includes('mom handles') || lower.includes('dad handles'))) {
    // Find which parent is mentioned and which event
    const targetParent = lower.includes('mom') ? otherParent : respondingParent
    // This is a simple heuristic — in practice, Claude's resolution text
    // would be more specific and we'd match against event titles
    const events = [...updated.events]
    for (let i = 0; i < events.length; i++) {
      if (!events[i].transportParentId) {
        events[i] = { ...events[i], transportParentId: targetParent.id }
        break
      }
    }
    updated.events = events
  }

  // If the responding parent volunteers ("I can do...")
  if (lower.includes('volunteer') || lower.includes('i can') || lower.includes('handles')) {
    const events = [...updated.events]
    for (let i = 0; i < events.length; i++) {
      if (!events[i].transportParentId) {
        events[i] = { ...events[i], transportParentId: respondingParent.id }
        break
      }
    }
    updated.events = events
  }

  return updated
}

/** Recompute transport-related conflicts after changes */
function recomputeTransportConflicts(plan: DailyPlan): DailyPlan['conflicts'] {
  const remaining = plan.conflicts.filter((c) => c.type !== 'transport_unassigned')

  // Check for any events still without transport
  for (let i = 0; i < plan.events.length; i++) {
    const event = plan.events[i]
    if (!event.transportParentId) {
      remaining.push({
        type: 'transport_unassigned',
        description: `No one assigned to drive to "${event.title}".`,
        affectedEventIds: [event.calendarEventId || `event-${i}`],
        suggestedResolutions: [
          'Custody parent handles this drop-off',
          'Other parent volunteers',
          'Arrange a carpool',
        ],
      })
    }
  }

  return remaining
}

/** Format a change confirmation SMS */
async function formatChangeSMS(
  plan: DailyPlan,
  custodyParent: Parent,
  allParents: Parent[],
  changeDescription: string,
): Promise<string> {
  const parentNames = new Map(allParents.map((p) => [p.id, p.name]))

  let text = `✏️ Plan updated for ${plan.date}:\n\n`
  text += `${changeDescription}\n\n`

  if (plan.conflicts.length === 0) {
    text += '✅ No remaining conflicts.\n'
  } else {
    text += `⚠️ ${plan.conflicts.length} conflict(s) remaining.\n`
  }

  text += 'Reply OK or text changes.'
  return text
}
