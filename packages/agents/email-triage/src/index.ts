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
import { createSchema, recordProcessedEmail, isAlreadyProcessed } from './db'

const PORT = parseInt(process.env.PORT || '3002', 10)
const NOTIFICATION_MODE = process.env.GMAIL_NOTIFICATION_MODE || 'poll'

validateEnvironment()

const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
const redisClient = createClient({ url: process.env.REDIS_URL }) as unknown as RedisClient

let isPostgresConnected = false

const proxyUrl = process.env.CREDENTIAL_PROXY_URL!
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || `${proxyUrl}/anthropic`
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'placeholder'

// Comma-separated list of account names matching token files
const accounts = (process.env.GMAIL_ACCOUNTS || 'default').split(',').map((s) => s.trim())

const newsletterConfig = loadNewsletterConfig()

async function handleNewMessage(email: ParsedEmail, account: string): Promise<void> {
  // Skip drafts and outbound-only sent messages (not self-sends)
  if (email.labels.includes('DRAFT')) {
    console.log(`[${account}] Skipping ${email.messageId} (draft)`)
    return
  }
  if (email.labels.includes('SENT') && !email.labels.includes('INBOX')) {
    console.log(`[${account}] Skipping ${email.messageId} (sent, not inbox)`)
    return
  }

  // Skip already-processed messages
  if (await isAlreadyProcessed(pgClient, email.messageId)) {
    console.log(`[${account}] Skipping ${email.messageId} (already processed)`)
    return
  }

  console.log(`[${account}] Triaging: "${email.subject}" from ${email.from}`)

  const gmail = new GmailClient(proxyUrl, account)
  const decision = await classifyEmail(email, {
    anthropicBaseUrl,
    anthropicApiKey,
    newsletterConfig,
  })

  console.log(`[${account}]   → ${decision.category} (${decision.confidence}) — ${decision.reason}`)

  const result = await executeActions(email, decision, {
    gmail,
    anthropicBaseUrl,
    anthropicApiKey,
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

const app = createApp(pgClient, redisClient, () => isPostgresConnected)

pgClient.on('error', (err: Error) => {
  console.error('PostgreSQL error:', err)
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
    })
    await poller.start()
    pollers.push(poller)
    console.log(`Polling account: ${account}`)
  }
}

async function startPubSub() {
  const projectId = process.env.GCP_PROJECT_ID!
  const subscriptionName = process.env.PUBSUB_SUBSCRIPTION || 'gmail-notifications-pull'
  const topicName = process.env.PUBSUB_TOPIC!

  const listener = new PubSubListener(projectId, subscriptionName)

  const watchers: GmailWatcher[] = []
  for (const account of accounts) {
    const gmail = new GmailClient(proxyUrl, account)
    const watcher = new GmailWatcher({
      gmail,
      redis: redisClient,
      topicName,
      onNewMessage: (email) => handleNewMessage(email, account),
    })
    await watcher.start()
    watchers.push(watcher)

    // Get account email for pub/sub routing
    const profile = await gmail.getProfile()
    listener.onNotification(profile.emailAddress, () => watcher.handleNotification())
    console.log(`Watching account: ${account} (${profile.emailAddress})`)
  }

  await listener.start()
}

async function start() {
  await pgClient.connect()
  await redisClient.connect()
  isPostgresConnected = true
  console.log('Connected to PostgreSQL and Redis')

  await createSchema(pgClient)

  if (NOTIFICATION_MODE === 'pubsub') {
    await startPubSub()
  } else {
    await startPolling()
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`Email triage agent running on port ${PORT} (mode: ${NOTIFICATION_MODE})`)
  console.log(`Accounts: ${accounts.join(', ')}`)
}

start().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
