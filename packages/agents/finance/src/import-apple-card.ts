import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { createLogger } from '@grund/logger'
import { createSchema, upsertAccount, recordTransaction } from './db'
import { parseAppleCardCsv, APPLE_CARD_ACCOUNT } from './import/apple-card'

// One-shot importer for Apple Card monthly statement CSV exports. Run on the
// host against the same Postgres the agent uses; the running agent categorizes
// the new rows on its next cycle.
//
//   DATABASE_URL=postgres://grund:grund_db_2024@localhost:5432/grund \
//     bun run import-apple-card ./apple-card-statement.csv

const log = createLogger('finance-import')

async function main() {
  const file = process.argv[2]
  if (!file) {
    log.error('Usage: bun run import-apple-card <statement.csv>')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    log.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const transactions = parseAppleCardCsv(readFileSync(file, 'utf-8'))
  if (transactions.length === 0) {
    log.warn({ file }, 'No transactions found in CSV')
    process.exit(0)
  }

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
  await pgClient.connect()
  try {
    await createSchema(pgClient) // idempotent; covers running before the agent
    await upsertAccount(pgClient, APPLE_CARD_ACCOUNT)

    let inserted = 0
    for (const txn of transactions) {
      if (await recordTransaction(pgClient, txn)) inserted++
    }

    log.info(
      { file, parsed: transactions.length, inserted, skipped: transactions.length - inserted },
      'Apple Card import complete',
    )
  } finally {
    await pgClient.end()
  }
}

main().catch((err) => {
  log.error({ err }, 'Apple Card import failed')
  process.exit(1)
})
