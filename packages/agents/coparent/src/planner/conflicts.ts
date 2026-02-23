import { config } from '../config'
import { minutesBetween } from '../utils/time'
import type { Conflict, PlannedEvent, CalendarEvent } from '../models/types'

const TIGHT_TRANSITION_MINUTES = config.planGeneration.tightTransitionMinutes

/**
 * Detect all logistics conflicts in a set of planned events.
 *
 * Conflict types:
 * - schedule_overlap: two events at the same time for the same child
 * - tight_transition: < 15 min between events for the same child or same driver
 * - transport_unassigned: no one assigned to drive
 * - custody_switch_conflict: custody changes today with activities on both sides
 * - no_coverage: custody parent has a conflicting personal event
 */
export function detectConflicts(
  events: PlannedEvent[],
  custodyParentId: string,
  custodyParentCalendarEvents: CalendarEvent[],
  isCustodySwitchDay: boolean,
): Conflict[] {
  const conflicts: Conflict[] = []

  conflicts.push(...detectScheduleOverlaps(events))
  conflicts.push(...detectTightTransitions(events))
  conflicts.push(...detectTransportConflicts(events, custodyParentId))
  conflicts.push(...detectNoCoverage(events, custodyParentId, custodyParentCalendarEvents))

  if (isCustodySwitchDay) {
    conflicts.push(...detectCustodySwitchConflicts(events))
  }

  return conflicts
}

/** Two events at the same time for the same child */
function detectScheduleOverlaps(events: PlannedEvent[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i]
      const b = events[j]

      if (!eventsOverlap(a, b)) continue

      // Check if they share a child
      const sharedChildren = a.childIds.filter((id) => b.childIds.includes(id))
      if (sharedChildren.length > 0) {
        conflicts.push({
          type: 'schedule_overlap',
          description: `"${a.title}" and "${b.title}" overlap — same child(ren) can't be in both places.`,
          affectedEventIds: [a.calendarEventId || `event-${i}`, b.calendarEventId || `event-${j}`],
          suggestedResolutions: [
            `Reschedule one of the events`,
            `Skip one event this time`,
            `Check if a different time slot is available`,
          ],
        })
      }

      // Check if same parent is expected to drive both
      if (
        a.transportParentId &&
        b.transportParentId &&
        a.transportParentId === b.transportParentId
      ) {
        conflicts.push({
          type: 'schedule_overlap',
          description: `"${a.title}" and "${b.title}" overlap — same parent can't drive to both.`,
          affectedEventIds: [a.calendarEventId || `event-${i}`, b.calendarEventId || `event-${j}`],
          suggestedResolutions: [
            `Other parent handles one drop-off`,
            `Arrange a carpool for one event`,
            `Check if timing can be adjusted`,
          ],
        })
      }
    }
  }

  return conflicts
}

/** Less than threshold minutes between consecutive events for the same child or driver */
function detectTightTransitions(events: PlannedEvent[]): Conflict[] {
  const conflicts: Conflict[] = []

  // Sort by start time
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]

    const gap = minutesBetween(current.endTime, next.startTime)
    if (gap >= 0 && gap < TIGHT_TRANSITION_MINUTES) {
      // Check if same child or same driver is involved
      const sharedChildren = current.childIds.filter((id) => next.childIds.includes(id))
      const sameDriver =
        current.transportParentId &&
        next.transportParentId &&
        current.transportParentId === next.transportParentId

      if (sharedChildren.length > 0 || sameDriver) {
        const locationNote =
          current.location && next.location && current.location !== next.location
            ? ` (different locations: ${current.location} → ${next.location})`
            : ''

        conflicts.push({
          type: 'tight_transition',
          description: `Only ${Math.round(gap)} min between "${current.title}" ending and "${next.title}" starting${locationNote}.`,
          affectedEventIds: [
            current.calendarEventId || `event-${i}`,
            next.calendarEventId || `event-${i + 1}`,
          ],
          suggestedResolutions: [
            `Leave "${current.title}" early`,
            `Arrive late to "${next.title}"`,
            `Have the other parent handle the second drop-off`,
          ],
        })
      }
    }
  }

  return conflicts
}

/** Events where no parent is assigned to drive */
function detectTransportConflicts(events: PlannedEvent[], custodyParentId: string): Conflict[] {
  const conflicts: Conflict[] = []

  // First pass: check for events without transport
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (!event.transportParentId) {
      conflicts.push({
        type: 'transport_unassigned',
        description: `No one assigned to drive to "${event.title}".`,
        affectedEventIds: [event.calendarEventId || `event-${i}`],
        suggestedResolutions: [
          `Custody parent handles this drop-off`,
          `Other parent volunteers`,
          `Arrange a carpool`,
        ],
      })
    }
  }

  return conflicts
}

/** Custody parent has a conflicting personal calendar event during a child's activity */
function detectNoCoverage(
  events: PlannedEvent[],
  custodyParentId: string,
  custodyParentCalendarEvents: CalendarEvent[],
): Conflict[] {
  const conflicts: Conflict[] = []

  for (let i = 0; i < events.length; i++) {
    const kidEvent = events[i]
    if (kidEvent.transportParentId !== custodyParentId) continue

    for (const parentEvent of custodyParentCalendarEvents) {
      if (
        eventsOverlapByTime(
          kidEvent.startTime,
          kidEvent.endTime,
          parentEvent.startTime,
          parentEvent.endTime,
        )
      ) {
        conflicts.push({
          type: 'no_coverage',
          description: `Custody parent has "${parentEvent.title}" during "${kidEvent.title}" — may not be available for transport.`,
          affectedEventIds: [kidEvent.calendarEventId || `event-${i}`],
          suggestedResolutions: [
            `Other parent handles this drop-off/pickup`,
            `Arrange a carpool`,
            `Reschedule parent's event`,
          ],
        })
        break // One conflict per kid event is enough
      }
    }
  }

  return conflicts
}

/** Flag events that need coordination across a custody switch */
function detectCustodySwitchConflicts(events: PlannedEvent[]): Conflict[] {
  if (events.length === 0) return []

  return [
    {
      type: 'custody_switch_conflict',
      description: `Custody switches today. Activities may need gear from the other parent's house.`,
      affectedEventIds: events
        .filter((e) => e.itemsNeeded.length > 0)
        .map((e, i) => e.calendarEventId || `event-${i}`),
      suggestedResolutions: [
        `Bring gear to school at morning drop-off`,
        `Receiving parent picks up gear before activities`,
        `Keep a duplicate set at each house for key items`,
      ],
    },
  ]
}

// --- Helpers ---

function eventsOverlap(a: PlannedEvent, b: PlannedEvent): boolean {
  return eventsOverlapByTime(a.startTime, a.endTime, b.startTime, b.endTime)
}

function eventsOverlapByTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aStartTime = new Date(aStart).getTime()
  const aEndTime = new Date(aEnd).getTime()
  const bStartTime = new Date(bStart).getTime()
  const bEndTime = new Date(bEnd).getTime()

  return aStartTime < bEndTime && bStartTime < aEndTime
}
