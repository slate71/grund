import { Client } from 'pg'
import type { NormalizedAccount, NormalizedTransaction } from './simplefin/types'
import type { CategoryDecision, CategorizableTransaction } from './categorize/types'
import { NON_SPENDING_CATEGORIES } from './categorize/types'

// Bootstraps the finance tables at runtime. Mirrors the canonical Drizzle schema
// in @grund/db (packages/db/src/schema/finance.ts) and the self-bootstrap pattern
// used by email-triage and heartbeat.
export async function createSchema(pgClient: Client): Promise<void> {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS finance_accounts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      org TEXT,
      name TEXT NOT NULL,
      type TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      balance NUMERIC(14,2),
      available_balance NUMERIC(14,2),
      balance_date TIMESTAMPTZ,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      external_id TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL REFERENCES finance_accounts(external_id),
      posted_at TIMESTAMPTZ NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      payee TEXT,
      description TEXT,
      memo TEXT,
      pending BOOLEAN NOT NULL DEFAULT FALSE,
      category TEXT,
      category_confidence REAL,
      category_reason TEXT,
      categorized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS finance_sync_state (
      source TEXT PRIMARY KEY,
      last_sync_at TIMESTAMPTZ,
      cursor TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)

  await pgClient.query(
    `CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON transactions(posted_at)`,
  )
  await pgClient.query(
    `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`,
  )
  await pgClient.query(
    `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`,
  )
}

// Insert or refresh an account. Balances and sync time are updated on conflict.
export async function upsertAccount(pgClient: Client, acct: NormalizedAccount): Promise<void> {
  await pgClient.query(
    `INSERT INTO finance_accounts
      (external_id, org, name, type, currency, balance, available_balance, balance_date, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (external_id) DO UPDATE SET
       org = EXCLUDED.org,
       name = EXCLUDED.name,
       currency = EXCLUDED.currency,
       balance = EXCLUDED.balance,
       available_balance = EXCLUDED.available_balance,
       balance_date = EXCLUDED.balance_date,
       last_synced_at = NOW()`,
    [
      acct.externalId,
      acct.org,
      acct.name,
      acct.type,
      acct.currency,
      acct.balance,
      acct.availableBalance,
      acct.balanceDate,
    ],
  )
}

// Insert a transaction if new. Returns true when a row was actually inserted, so
// callers can count fresh transactions and avoid re-categorizing existing ones.
export async function recordTransaction(
  pgClient: Client,
  txn: NormalizedTransaction,
): Promise<boolean> {
  const result = await pgClient.query(
    `INSERT INTO transactions
      (external_id, account_id, posted_at, amount, payee, description, memo, pending)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (external_id) DO NOTHING`,
    [
      txn.externalId,
      txn.accountId,
      txn.postedAt,
      txn.amount,
      txn.payee,
      txn.description,
      txn.memo,
      txn.pending,
    ],
  )
  return (result.rowCount ?? 0) > 0
}

// Transactions awaiting a category, oldest first.
export async function getUncategorized(
  pgClient: Client,
  limit: number = 25,
): Promise<CategorizableTransaction[]> {
  const result = await pgClient.query(
    `SELECT external_id, payee, description, memo, amount::text AS amount
     FROM transactions
     WHERE category IS NULL
     ORDER BY posted_at ASC
     LIMIT $1`,
    [limit],
  )
  return result.rows.map((r) => ({
    externalId: r.external_id,
    payee: r.payee,
    description: r.description,
    memo: r.memo,
    amount: r.amount,
  }))
}

export async function setCategory(
  pgClient: Client,
  externalId: string,
  decision: CategoryDecision,
): Promise<void> {
  await pgClient.query(
    `UPDATE transactions
     SET category = $2, category_confidence = $3, category_reason = $4, categorized_at = NOW()
     WHERE external_id = $1`,
    [externalId, decision.category, decision.confidence, decision.reason],
  )
}

export async function getRecentTransactions(
  pgClient: Client,
  limit: number = 50,
): Promise<Record<string, unknown>[]> {
  const result = await pgClient.query(
    `SELECT external_id, account_id, posted_at, amount::text AS amount, payee, description,
            pending, category, category_confidence
     FROM transactions
     ORDER BY posted_at DESC
     LIMIT $1`,
    [limit],
  )
  return result.rows
}

// Spending totals by category over the last N days. Excludes income/transfer and
// counts outflows as positive amounts.
export async function getSpendingByCategory(
  pgClient: Client,
  days: number = 30,
): Promise<{ category: string; total: number; count: number }[]> {
  const result = await pgClient.query(
    `SELECT COALESCE(category, 'uncategorized') AS category,
            SUM(-amount)::float AS total,
            COUNT(*)::int AS count
     FROM transactions
     WHERE amount < 0
       AND posted_at > NOW() - INTERVAL '1 day' * $1
       AND (category IS NULL OR category <> ALL($2))
     GROUP BY 1
     ORDER BY total DESC`,
    [days, NON_SPENDING_CATEGORIES],
  )
  return result.rows as { category: string; total: number; count: number }[]
}

export async function getSyncState(
  pgClient: Client,
  source: string,
): Promise<{ lastSyncAt: Date | null } | null> {
  const result = await pgClient.query(
    `SELECT last_sync_at FROM finance_sync_state WHERE source = $1`,
    [source],
  )
  if (result.rowCount === 0) return null
  return { lastSyncAt: result.rows[0].last_sync_at }
}

export async function updateSyncState(pgClient: Client, source: string): Promise<void> {
  await pgClient.query(
    `INSERT INTO finance_sync_state (source, last_sync_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT (source) DO UPDATE SET last_sync_at = NOW(), updated_at = NOW()`,
    [source],
  )
}
