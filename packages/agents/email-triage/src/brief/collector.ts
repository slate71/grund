import { Client } from 'pg'
import { BRIEF_CATEGORIES, type BriefEmail } from './types'

/**
 * Collect all non-urgent processed emails since the given timestamp.
 * These are the emails that belong in the daily brief.
 */
export async function collectBriefEmails(
  pgClient: Client,
  since: Date,
  until: Date = new Date(),
): Promise<BriefEmail[]> {
  const placeholders = BRIEF_CATEGORIES.map((_, i) => `$${i + 3}`).join(', ')

  const result = await pgClient.query(
    `SELECT gmail_message_id, from_address, subject, category, reason, processed_at
     FROM processed_emails
     WHERE processed_at >= $1
       AND processed_at < $2
       AND category IN (${placeholders})
     ORDER BY processed_at DESC`,
    [since.toISOString(), until.toISOString(), ...BRIEF_CATEGORIES],
  )

  return result.rows.map((row) => ({
    gmailMessageId: row.gmail_message_id,
    fromAddress: row.from_address,
    subject: row.subject,
    category: row.category,
    reason: row.reason,
    processedAt: new Date(row.processed_at),
  }))
}
