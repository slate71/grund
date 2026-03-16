import { Client } from 'pg'
import { createClient } from 'redis'
import { validateEnvironment, createApp } from './app'
import { GmailClient } from './gmail/client'
import { GmailPoller, type RedisClient } from './gmail/poller'
import { GmailWatcher } from './gmail/watcher'
import { PubSubListener } from './gmail/pubsub-listener'
import type { ParsedEmail } from './gmail/types'
import { classifyEmail } from './triage/classifier'
import { executeActions } from './triage/actions'
import { loadNewsletterConfig } from './config/newsletters'
import { createSchema, createBriefSchema, recordProcessedEmail, isAlreadyProcessed } from './db'
import { createLogger } from '@grund/logger'
import { startBriefScheduler } from './brief/scheduler'
import type { BriefConfig } from './brief/types'

const PORT = parseInt(process.env.PORT || '3002', 10)
const NOTIFICATION_MODE = process.env.GMAIL_NOTIFICATION_MODE || 'poll'

const log = createLogger('email-triage')

validateEnvironment(log)

const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
const redisClient = createClient({ url: process.env.REDIS_URL }) as unknown as RedisClient

let isPostgresConnected = false

const proxyUrl = process.env.CREDENTIAL_PROXY_URL!
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || `${proxyUrl}/anthropic`
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'placeholder'

// Comma-separated list of account names matching token files
const accounts = (process.env.GMAIL_ACCOUNTS || 'default').split(',').map((s) => s.trim())

const newsletterConfig = loadNewsletterConfig()

// Brief configuration from environment
const BRIEF_ENABLED = process.env.BRIEF_ENABLED !== 'false' // enabled by default
const BRIEF_SCHEDULE_HOURS = (process.env.BRIEF_SCHEDULE_HOURS || '7,15')
  .split(',')
  .map((h) => parseInt(h.trim(), 10))
const BRIEF_TIMEZONE = process.env.BRIEF_TIMEZONE || 'America/Los_Angeles'

async function handleNewMessage(email: ParsedEmail, account: string): Promise<void> {
  const accountLog = log.child({ account })

  // Skip drafts and outbound-only sent messages (not self-sends)
  if (email.labels.includes('DRAFT')) {
    accountLog.debug({ messageId: email.messageId }, 'Skipping (draft)')
    return
  }
  if (email.labels.includes('SENT') && !email.labels.includes('INBOX')) {
    accountLog.debug({ messageId: email.messageId }, 'Skipping (sent, not inbox)')
    return
  }

  // Skip already-processed messages
  if (await isAlreadyProcessed(pgClient, email.messageId)) {
    accountLog.debug({ messageId: email.messageId }, 'Skipping (already processed)')
    return
  }

  // Acquire processing lock to prevent duplicate handling from concurrent pub/sub notifications
  const lockKey = `email-triage:lock:${email.messageId}`
  const acquired = await redisClient.set(lockKey, '1', { NX: true, EX: 300 })
  if (!acquired) {
    accountLog.debug({ messageId: email.messageId }, 'Skipping (already being processed)')
    return
  }

  accountLog.info({ messageId: email.messageId, subject: email.subject, from: email.from }, 'Triaging')

  const gmail = new GmailClient(proxyUrl, account)
  const decision = await classifyEmail(email, {
    anthropicBaseUrl,
    anthropicApiKey,
    newsletterConfig,
  })

  accountLog.info(
    { messageId: email.messageId, category: decision.category, confidence: decision.confidence, reason: decision.reason },
    'Classified',
  )

  const result = await executeActions(email, decision, {
    gmail,
    anthropicBaseUrl,
    anthropicApiKey,
    log: accountLog,
  })

  await recordProcessedEmail(pgClient, {
    gmailMessageId: email.messageId,
    gmailThreadId: email.threadId,
    fromAddress: email.from,
    subject: email.subject,
    category: decision.category,
    confidence: decision.confidence,
    reason: decision.reason,
    draftCreated: result.draftCreated,
    archived: result.archived,
  })

  // Publish triage event to Redis
  await redisClient.publish(
    'email-triage',
    JSON.stringify({
      account,
      messageId: email.messageId,
      category: decision.category,
      subject: email.subject,
      from: email.from,
      draftCreated: result.draftCreated,
      archived: result.archived,
    }),
  )
}

const app = createApp(pgClient, redisClient, () => isPostgresConnected, log)

pgClient.on('error', (err: Error) => {
  log.error({ err }, 'PostgreSQL error')
  isPostgresConnected = false
})

async function startPolling() {
  const pollers: GmailPoller[] = []
  for (const account of accounts) {
    const gmail = new GmailClient(proxyUrl, account)
    const poller = new GmailPoller({
      gmail,
      redis: redisClient,
      onNewMessage: (email) => handleNewMessage(email, account),
      log: log.child({ account }),
    })
    await poller.start()
    pollers.push(poller)
    log.info({ account }, 'Polling account')
  }
}

async function startPubSub() {
  const projectId = process.env.GCP_PROJECT_ID!
  const subscriptionName = process.env.PUBSUB_SUBSCRIPTION || 'gmail-notifications-pull'
  const topicName = process.env.PUBSUB_TOPIC!

  const listener = new PubSubListener(projectId, subscriptionName, log)

  const watchers: GmailWatcher[] = []
  for (const account of accounts) {
    const gmail = new GmailClient(proxyUrl, account)
    const watcher = new GmailWatcher({
      gmail,
      redis: redisClient,
      topicName,
      onNewMessage: (email) => handleNewMessage(email, account),
      log: log.child({ account }),
    })
    await watcher.start()
    watchers.push(watcher)

    // Get account email for pub/sub routing
    const profile = await gmail.getProfile()
    listener.onNotification(profile.emailAddress, () => watcher.handleNotification())
    log.info({ account, email: profile.emailAddress }, 'Watching account')
  }

  await listener.start()
}

async function start() {
  await pgClient.connect()
  await redisClient.connect()
  isPostgresConnected = true
  log.info('Connected to PostgreSQL and Redis')

  await createSchema(pgClient)
  await createBriefSchema(pgClient)

  if (NOTIFICATION_MODE === 'pubsub') {
    await startPubSub()
  } else {
    await startPolling()
  }

  // Start daily brief scheduler
  if (BRIEF_ENABLED) {
    const primaryAccount = accounts[0]
    const gmail = new GmailClient(proxyUrl, primaryAccount)
    const profile = await gmail.getProfile()

    const briefConfig: BriefConfig = {
      scheduleHours: BRIEF_SCHEDULE_HOURS,
      timezone: BRIEF_TIMEZONE,
    }

    startBriefScheduler({
      pgClient,
      gmail,
      recipientEmail: process.env.BRIEF_RECIPIENT || profile.emailAddress,
      config: briefConfig,
      log: log.child({ module: 'brief' }),
    })

    log.info({ scheduleHours: BRIEF_SCHEDULE_HOURS, timezone: BRIEF_TIMEZONE }, 'Daily brief enabled')
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })
  log.info({ port: PORT, mode: NOTIFICATION_MODE, accounts }, 'Email triage agent running')
}

start().catch((err) => {
  log.error({ err }, 'Failed to start')
  process.exit(1)
})
