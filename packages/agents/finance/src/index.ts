import { Client } from 'pg'
import { createClient } from 'redis'
import cron from 'node-cron'
import { createLogger } from '@grund/logger'
import { validateEnvironment, createApp, type RedisClient } from './app'
import {
  createSchema,
  upsertAccount,
  recordTransaction,
  getUncategorized,
  setCategory,
  getSyncState,
  updateSyncState,
} from './db'
import { SimpleFinClient, ProxyRouteNotConfiguredError } from './simplefin/client'
import { categorizeTransaction } from './categorize/categorizer'

const PORT = parseInt(process.env.PORT || '3003', 10)
const SYNC_SOURCE = 'simplefin'
const CATEGORIZE_BATCH = parseInt(process.env.CATEGORIZE_BATCH || '25', 10)
// Upper bound on transactions categorized per run, so a large first sync can't
// trigger an unbounded burst of Claude calls. The remainder is picked up next tick.
const CATEGORIZE_MAX_PER_RUN = parseInt(process.env.CATEGORIZE_MAX_PER_RUN || '500', 10)

const log = createLogger('finance')

validateEnvironment(log)

const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
const redisClient = createClient({ url: process.env.REDIS_URL }) as unknown as RedisClient

let isPostgresConnected = false

const proxyUrl = process.env.CREDENTIAL_PROXY_URL!
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || `${proxyUrl}/anthropic`
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'placeholder'

const simplefin = new SimpleFinClient(proxyUrl)

const isSyncing = { value: false }
const isCategorizing = { value: false }

// Pull new accounts + transactions from the aggregator and persist them. The
// SimpleFIN proxy route arrives in milestone 2; until then this logs a warning
// and exits cleanly each run.
async function runSync(): Promise<void> {
  if (isSyncing.value) {
    log.debug('Sync already in progress, skipping')
    return
  }
  isSyncing.value = true
  try {
    const state = await getSyncState(pgClient, SYNC_SOURCE)
    const { accounts, transactions } = await simplefin.sync(state?.lastSyncAt ?? null)

    for (const account of accounts) {
      await upsertAccount(pgClient, account)
    }

    let inserted = 0
    for (const txn of transactions) {
      if (await recordTransaction(pgClient, txn)) inserted++
    }

    await updateSyncState(pgClient, SYNC_SOURCE)
    log.info(
      { accounts: accounts.length, transactions: transactions.length, inserted },
      'Sync complete',
    )
  } catch (err) {
    if (err instanceof ProxyRouteNotConfiguredError) {
      log.warn({ reason: err.message }, 'Skipping sync — aggregator not wired yet')
    } else {
      log.error({ err }, 'Sync failed')
    }
  } finally {
    isSyncing.value = false
  }
}

// Categorize a batch of uncategorized transactions via Claude, persisting each
// decision and publishing an event the dashboard can show.
async function runCategorize(): Promise<void> {
  if (isCategorizing.value) {
    log.debug('Categorization already in progress, skipping')
    return
  }
  isCategorizing.value = true
  // Count attempts (each = one Claude call), so the cap bounds cost and a batch
  // of persistently-failing rows can't spin forever.
  let attempted = 0
  try {
    // Drain the backlog in batches so a fresh sync is fully categorized in one
    // run, rather than 25 transactions per cron tick. Bounded by CATEGORIZE_MAX_PER_RUN.
    while (attempted < CATEGORIZE_MAX_PER_RUN) {
      const pending = await getUncategorized(pgClient, CATEGORIZE_BATCH)
      if (pending.length === 0) break

      log.info({ count: pending.length }, 'Categorizing transactions')
      let succeeded = 0
      for (const txn of pending) {
        attempted++
        try {
          const decision = await categorizeTransaction(txn, { anthropicBaseUrl, anthropicApiKey })
          await setCategory(pgClient, txn.externalId, decision)
          await redisClient.publish(
            'finance',
            JSON.stringify({
              externalId: txn.externalId,
              payee: txn.payee,
              amount: txn.amount,
              category: decision.category,
              confidence: decision.confidence,
            }),
          )
          succeeded++
          log.info(
            { payee: txn.payee, category: decision.category, confidence: decision.confidence },
            'Categorized',
          )
        } catch (err) {
          log.error({ err, externalId: txn.externalId }, 'Failed to categorize transaction')
        }
        if (attempted >= CATEGORIZE_MAX_PER_RUN) break
      }

      // Every row in the batch failed — getUncategorized would just return the
      // same stuck rows, so stop rather than loop on them.
      if (succeeded === 0) {
        log.warn({ batch: pending.length }, 'Batch made no progress; stopping run')
        break
      }
    }

    if (attempted >= CATEGORIZE_MAX_PER_RUN) {
      log.warn(
        { attempted, cap: CATEGORIZE_MAX_PER_RUN },
        'Hit per-run categorization cap; remainder will be picked up next run',
      )
    }
  } finally {
    isCategorizing.value = false
  }
}

const app = createApp(pgClient, redisClient, () => isPostgresConnected, log)

pgClient.on('error', (err: Error) => {
  log.error({ err }, 'PostgreSQL error')
  isPostgresConnected = false
})

async function start() {
  await pgClient.connect()
  await redisClient.connect()
  isPostgresConnected = true
  log.info('Connected to PostgreSQL and Redis')

  await createSchema(pgClient)

  // Pull new transactions periodically, then categorize what landed.
  cron.schedule('*/30 * * * *', async () => {
    await runSync()
    await runCategorize()
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
  log.info({ port: PORT }, 'Finance agent running')

  // Kick an initial cycle so a fresh container starts working immediately.
  await runSync()
  await runCategorize()
}

start().catch((err) => {
  log.error({ err }, 'Failed to start')
  process.exit(1)
})
