import { describe, it, expect } from 'vitest'
import { detectConflicts } from './conflicts'
import type { PlannedEvent, CalendarEvent } from '../models/types'

const DAD_ID = 'dad-123'
const MOM_ID = 'mom-456'
const ELI_ID = 'eli-789'
const MILO_ID = 'milo-012'

function makeEvent(overrides: Partial<PlannedEvent> = {}): PlannedEvent {
  return {
    calendarEventId: 'cal-1',
    title: 'Test Event',
    startTime: '2026-02-24T16:00:00-08:00',
    endTime: '2026-02-24T17:00:00-08:00',
    location: 'Test Location',
    childIds: [ELI_ID],
    itemsNeeded: [],
    transportParentId: DAD_ID,
    notes: '',
    ...overrides,
  }
}

function makeCalEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'parent-cal-1',
    calendarId: 'dad@gmail.com',
    title: 'Work Meeting',
    startTime: '2026-02-24T16:00:00-08:00',
    endTime: '2026-02-24T17:00:00-08:00',
    location: 'Office',
    description: '',
    ...overrides,
  }
}

describe('detectConflicts', () => {
  describe('schedule_overlap', () => {
    it('detects overlapping events for the same child', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:30:00-08:00',
          childIds: [ELI_ID],
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Piano',
          startTime: '2026-02-24T16:15:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [ELI_ID],
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const overlaps = conflicts.filter((c) => c.type === 'schedule_overlap')
      expect(overlaps.length).toBeGreaterThanOrEqual(1)
      expect(overlaps[0].affectedEventIds).toContain('ev-1')
      expect(overlaps[0].affectedEventIds).toContain('ev-2')
    })

    it('does not flag overlap for different children at different locations', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:30:00-08:00',
          childIds: [ELI_ID],
          transportParentId: DAD_ID,
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Swimming',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [MILO_ID],
          transportParentId: MOM_ID,
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      // No child overlap and different drivers — should not conflict
      const childOverlaps = conflicts.filter(
        (c) => c.type === 'schedule_overlap' && c.description.includes("same child"),
      )
      expect(childOverlaps).toHaveLength(0)
    })

    it('detects overlap when same parent must drive to two places', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:30:00-08:00',
          childIds: [ELI_ID],
          transportParentId: DAD_ID,
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Swimming',
          startTime: '2026-02-24T16:15:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [MILO_ID],
          transportParentId: DAD_ID,
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const driverOverlaps = conflicts.filter(
        (c) => c.type === 'schedule_overlap' && c.description.includes("can't drive"),
      )
      expect(driverOverlaps.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('tight_transition', () => {
    it('detects events with less than 15 minutes between them', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [ELI_ID],
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Piano',
          startTime: '2026-02-24T17:10:00-08:00',
          endTime: '2026-02-24T17:55:00-08:00',
          childIds: [ELI_ID],
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const tight = conflicts.filter((c) => c.type === 'tight_transition')
      expect(tight).toHaveLength(1)
      expect(tight[0].description).toContain('10 min')
    })

    it('does not flag transitions with 15+ minutes gap', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [ELI_ID],
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Piano',
          startTime: '2026-02-24T17:30:00-08:00',
          endTime: '2026-02-24T18:15:00-08:00',
          childIds: [ELI_ID],
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const tight = conflicts.filter((c) => c.type === 'tight_transition')
      expect(tight).toHaveLength(0)
    })
  })

  describe('transport_unassigned', () => {
    it('detects events with no transport parent assigned', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          transportParentId: undefined,
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const unassigned = conflicts.filter((c) => c.type === 'transport_unassigned')
      expect(unassigned).toHaveLength(1)
    })
  })

  describe('no_coverage', () => {
    it('detects when custody parent has a conflicting event', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:30:00-08:00',
          transportParentId: DAD_ID,
        }),
      ]

      const parentCalEvents = [
        makeCalEvent({
          title: 'Work Meeting',
          startTime: '2026-02-24T15:30:00-08:00',
          endTime: '2026-02-24T16:30:00-08:00',
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, parentCalEvents, false)
      const noCoverage = conflicts.filter((c) => c.type === 'no_coverage')
      expect(noCoverage).toHaveLength(1)
      expect(noCoverage[0].description).toContain('Work Meeting')
    })
  })

  describe('custody_switch_conflict', () => {
    it('flags events needing gear on custody switch days', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          itemsNeeded: ['cleats', 'shin guards'],
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], true)
      const switchConflicts = conflicts.filter((c) => c.type === 'custody_switch_conflict')
      expect(switchConflicts).toHaveLength(1)
      expect(switchConflicts[0].description).toContain('Custody switches today')
    })

    it('does not flag custody switch when not a switch day', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          itemsNeeded: ['cleats'],
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      const switchConflicts = conflicts.filter((c) => c.type === 'custody_switch_conflict')
      expect(switchConflicts).toHaveLength(0)
    })
  })

  describe('no conflicts', () => {
    it('returns empty array when no conflicts exist', () => {
      const events = [
        makeEvent({
          calendarEventId: 'ev-1',
          title: 'Soccer',
          startTime: '2026-02-24T16:00:00-08:00',
          endTime: '2026-02-24T17:00:00-08:00',
          childIds: [ELI_ID],
          transportParentId: DAD_ID,
        }),
        makeEvent({
          calendarEventId: 'ev-2',
          title: 'Piano',
          startTime: '2026-02-24T18:00:00-08:00',
          endTime: '2026-02-24T18:45:00-08:00',
          childIds: [ELI_ID],
          transportParentId: DAD_ID,
        }),
      ]

      const conflicts = detectConflicts(events, DAD_ID, [], false)
      expect(conflicts).toHaveLength(0)
    })
  })
})
