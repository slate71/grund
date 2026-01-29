import { pgTable, uuid, text, jsonb, timestamp, real, pgEnum } from 'drizzle-orm/pg-core'

export const outcomeEnum = pgEnum('outcome', ['success', 'failure', 'escalation', 'unclear'])

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(),
  conversation_id: text('conversation_id').notNull(),
  messages: jsonb('messages').notNull().$type<{ role: string; content: string }[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const classifications = pgTable('classifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id')
    .references(() => events.id)
    .notNull()
    .unique(),
  outcome: outcomeEnum('outcome').notNull(),
  confidence: real('confidence').notNull(),
  reason: text('reason').notNull(),
  signals: jsonb('signals').notNull().$type<string[]>(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
