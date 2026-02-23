import { pgTable, uuid, text, date, timestamp, pgEnum } from 'drizzle-orm/pg-core'

// Enums for contact pipeline
export const channelEnum = pgEnum('channel', ['linkedin', 'email', 'phone', 'referral'])
export const statusEnum = pgEnum('status', ['cold', 'contacted', 'replied', 'active', 'dead'])
export const eventTypeEnum = pgEnum('event_type', [
  'outreach_sent',
  'reply_received',
  'follow_up',
  'status_change',
])

// Contacts table - main pipeline tracking
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  company: text('company'),
  channel: channelEnum('channel').notNull(),
  status: statusEnum('status').notNull().default('cold'),
  last_touch_date: date('last_touch_date'),
  next_action: text('next_action'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Contact events - activity log
export const contactEvents = pgTable('contact_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  contact_id: uuid('contact_id')
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  event_type: eventTypeEnum('event_type').notNull(),
  note: text('note'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})