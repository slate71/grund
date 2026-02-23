// --- Reference / Configuration Types ---

export interface Parent {
  id: string
  name: string
  phone: string // E.164 format for Twilio
  calendarId: string // Google Calendar ID
  homeLabel: string // "Dad's" or "Mom's" — used in plan text
}

export interface Child {
  id: string
  name: string
  grade: string
  school: string
}

export interface Activity {
  id: string
  name: string // "Flag Football", "Swimming"
  matchPatterns: string[] // calendar event titles that match
  defaultLocation: string
  requiredItems: string[] // ["cleats", "shin guards", "water bottle"]
  childIds: string[] // which kids participate
}

export interface CustodyBlock {
  id: string
  parentId: string
  startDate: string // ISO date
  endDate: string // ISO date
  isRecurring: boolean
  recurrenceRule?: string // e.g., "every other week starting 2025-01-06"
}

// --- Plan Types ---

export interface DailyPlan {
  id: string
  date: string // ISO date
  custodyParentId: string // who has kids this day
  events: PlannedEvent[]
  conflicts: Conflict[]
  flags: PlanFlag[]
  status: 'draft' | 'sent' | 'confirmed_both' | 'confirmed_one' | 'modified'
  confirmedBy: string[] // parent IDs who confirmed
  version: number
  generatedAt: Date
  lastModifiedAt: Date
}

export interface PlannedEvent {
  calendarEventId?: string
  title: string
  startTime: string // ISO datetime
  endTime: string // ISO datetime
  location: string
  childIds: string[]
  itemsNeeded: string[] // derived from Activity.requiredItems
  transportParentId?: string // who's driving — may be unassigned
  notes: string
}

export type ConflictType =
  | 'schedule_overlap'
  | 'tight_transition'
  | 'transport_unassigned'
  | 'custody_switch_conflict'
  | 'no_coverage'

export interface Conflict {
  type: ConflictType
  description: string
  affectedEventIds: string[]
  suggestedResolutions: string[]
}

export type PlanFlagType = 'novel_event' | 'missing_info' | 'weather' | 'custody_switch_today'

export interface PlanFlag {
  type: PlanFlagType
  message: string
  requiresResponse: boolean
}

// --- Message Types ---

export interface MessageLog {
  id: string
  parentId: string
  direction: 'inbound' | 'outbound'
  body: string
  timestamp: Date
  parsedIntent?: string
  planModifications?: Record<string, unknown>
}

// --- Calendar Types ---

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  startTime: string // ISO datetime
  endTime: string // ISO datetime
  location?: string
  description?: string
}

// --- AI Parse Result ---

export type ParsedIntent =
  | 'CONFIRM'
  | 'CHANGE_TRANSPORT'
  | 'VOLUNTEER'
  | 'QUESTION'
  | 'SCHEDULE_CHANGE'
  | 'RESOLVE_CONFLICT'
  | 'COMMAND'
  | 'OTHER'

export interface ParseResult {
  intent: ParsedIntent
  changes: PlanChange[]
  clarificationNeeded: string | null
  commandType?: 'DETAILS' | 'WEEK' | 'TOMORROW' | 'HELP'
}

export interface PlanChange {
  type: 'assign_transport' | 'cancel_event' | 'reschedule_event' | 'add_note' | 'resolve_conflict'
  eventIndex?: number
  conflictIndex?: number
  parentId?: string
  details: string
}
