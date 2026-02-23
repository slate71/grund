import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'

// --- Enums ---

export const planStatusEnum = pgEnum('plan_status', [
  'draft',
  'sent',
  'confirmed_both',
  'confirmed_one',
  'modified',
])

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound'])

// --- Co-Parent Reference Tables ---

export const parents = pgTable('cp_parents', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(), // E.164 format
  calendarId: text('calendar_id').notNull(),
  homeLabel: text('home_label').notNull(), // "Dad's" or "Mom's"
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const children = pgTable('cp_children', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  grade: text('grade').notNull(),
  school: text('school').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const activities = pgTable('cp_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  matchPatterns: jsonb('match_patterns').notNull().$type<string[]>(),
  defaultLocation: text('default_location').notNull(),
  requiredItems: jsonb('required_items').notNull().$type<string[]>(),
  childIds: jsonb('child_ids').notNull().$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const custodyBlocks = pgTable('cp_custody_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id')
    .references(() => parents.id)
    .notNull(),
  startDate: text('start_date').notNull(), // ISO date string
  endDate: text('end_date').notNull(), // ISO date string
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrenceRule: text('recurrence_rule'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// --- Plan Tables ---

export const dailyPlans = pgTable('cp_daily_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: text('date').notNull(), // ISO date string
  custodyParentId: uuid('custody_parent_id')
    .references(() => parents.id)
    .notNull(),
  events: jsonb('events').notNull().$type<
    Array<{
      calendarEventId?: string
      title: string
      startTime: string
      endTime: string
      location: string
      childIds: string[]
      itemsNeeded: string[]
      transportParentId?: string
      notes: string
    }>
  >(),
  conflicts: jsonb('conflicts').notNull().$type<
    Array<{
      type: string
      description: string
      affectedEventIds: string[]
      suggestedResolutions: string[]
    }>
  >(),
  flags: jsonb('flags').notNull().$type<
    Array<{
      type: string
      message: string
      requiresResponse: boolean
    }>
  >(),
  status: planStatusEnum('status').notNull().default('draft'),
  confirmedBy: jsonb('confirmed_by').notNull().$type<string[]>().default([]),
  version: integer('version').notNull().default(1),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  lastModifiedAt: timestamp('last_modified_at', { withTimezone: true }).defaultNow().notNull(),
})

// --- Message Log ---

export const messageLogs = pgTable('cp_message_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id')
    .references(() => parents.id)
    .notNull(),
  direction: messageDirectionEnum('direction').notNull(),
  body: text('body').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  parsedIntent: text('parsed_intent'),
  planModifications: jsonb('plan_modifications').$type<Record<string, unknown>>(),
})
