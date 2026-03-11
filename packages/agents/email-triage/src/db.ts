import { Client } from 'pg'
import type { TriageCategory } from './triage/types'

export async function createSchema(pgClient: Client): Promise<void> {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS processed_emails (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      gmail_message_id TEXT NOT NULL UNIQUE,
      gmail_thread_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      subject TEXT,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      reason TEXT,
      draft_created BOOLEAN DEFAULT FALSE,
      archived BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_processed_emails_message_id
    ON processed_emails(gmail_message_id)
  `)

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_processed_emails_processed_at
    ON processed_emails(processed_at)
  `)
}

export async function recordProcessedEmail(
  pgClient: Client,
  data: {
    gmailMessageId: string
    gmailThreadId: string
    fromAddress: string
    subject: string
    category: TriageCategory
    confidence: number
    reason: string
    draftCreated: boolean
    archived: boolean
  },
): Promise<void> {
  await pgClient.query(
    `INSERT INTO processed_emails
      (gmail_message_id, gmail_thread_id, from_address, subject, category, confidence, reason, draft_created, archived)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (gmail_message_id) DO NOTHING`,
    [
      data.gmailMessageId,
      data.gmailThreadId,
      data.fromAddress,
      data.subject,
      data.category,
      data.confidence,
      data.reason,
      data.draftCreated,
      data.archived,
    ],
  )
}

export async function getRecentEmails(
  pgClient: Client,
  limit: number = 20,
): Promise<Record<string, unknown>[]> {
  const result = await pgClient.query(
    'SELECT * FROM processed_emails ORDER BY processed_at DESC LIMIT $1',
    [limit],
  )
  return result.rows
}

export async function getTriageStats(
  pgClient: Client,
  days: number = 7,
): Promise<{ category: string; count: number }[]> {
  const result = await pgClient.query(
    `SELECT category, COUNT(*)::int as count
     FROM processed_emails
     WHERE processed_at > NOW() - INTERVAL '1 day' * $1
     GROUP BY category
     ORDER BY count DESC`,
    [days],
  )
  return result.rows as { category: string; count: number }[]
}

export async function isAlreadyProcessed(
  pgClient: Client,
  gmailMessageId: string,
): Promise<boolean> {
  const result = await pgClient.query(
    'SELECT 1 FROM processed_emails WHERE gmail_message_id = $1',
    [gmailMessageId],
  )
  return (result.rowCount ?? 0) > 0
}
