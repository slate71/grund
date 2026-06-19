import { pgTable, uuid, text, numeric, boolean, real, timestamp } from 'drizzle-orm/pg-core'

// Finance domain: accounts + transactions pulled from an aggregator (SimpleFIN),
// with each transaction categorized by Claude — mirroring the events/classifications
// shape (category, confidence, reason) used elsewhere in the platform.
//
// These definitions are the canonical schema read by the API and dashboard. The
// finance agent bootstraps the same tables at runtime (see
// packages/agents/finance/src/db.ts), matching how email-triage and heartbeat
// self-create their operational tables.

// A financial account (checking, savings, credit card, …) as reported by the
// aggregator. `external_id` is the aggregator's stable account id.
export const financeAccounts = pgTable('finance_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  external_id: text('external_id').notNull().unique(),
  org: text('org'),
  name: text('name').notNull(),
  type: text('type'),
  currency: text('currency').notNull().default('USD'),
  balance: numeric('balance', { precision: 14, scale: 2 }),
  available_balance: numeric('available_balance', { precision: 14, scale: 2 }),
  balance_date: timestamp('balance_date', { withTimezone: true }),
  last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// A single transaction. `amount` is signed: negative = outflow (spending),
// positive = inflow (income/refund), matching the aggregator's convention.
// Category fields are null until the categorizer has processed the row.
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  external_id: text('external_id').notNull().unique(),
  account_id: text('account_id')
    .notNull()
    .references(() => financeAccounts.external_id),
  posted_at: timestamp('posted_at', { withTimezone: true }).notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  payee: text('payee'),
  description: text('description'),
  memo: text('memo'),
  pending: boolean('pending').notNull().default(false),
  category: text('category'),
  category_confidence: real('category_confidence'),
  category_reason: text('category_reason'),
  categorized_at: timestamp('categorized_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// Sync bookkeeping, one row per aggregator source (e.g. 'simplefin'). Tracks the
// last successful sync so ingestion can request only newer transactions.
export const financeSyncState = pgTable('finance_sync_state', {
  source: text('source').primaryKey(),
  last_sync_at: timestamp('last_sync_at', { withTimezone: true }),
  cursor: text('cursor'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
