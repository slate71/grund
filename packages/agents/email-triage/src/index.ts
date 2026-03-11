import { Client } from 'pg'
import { createClient } from 'redis'
import { validateEnvironment, createApp } from './app'
import { GmailClient } from './gmail/client'
import { GmailPoller, type RedisClient } from './gmail/poller'
import type { ParsedEmail } from './gmail/types'
import { classifyEmail } from './triage/classifier'
import { executeActions } from './triage/actions'
import { loadNewsletterConfig } from './config/newsletters'
import { createSchema, recordProcessedEmail, isAlreadyProcessed } from './db'

const PORT = parseInt(process.env.PORT || '3002', 10)

validateEnvironment()

const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
const redisClient = createClient({ url: process.env.REDIS_URL }) as unknown as RedisClient

let isPostgresConnected = false

const proxyUrl = process.env.CREDENTIAL_PROXY_URL!
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || `${proxyUrl}/anthropic`
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || 'placeholder'

const gmail = new GmailClient(proxyUrl)
const newsletterConfig = loadNewsletterConfig()

async function handleNewMessage(email: ParsedEmail): Promise<void> {
  // Skip drafts and outbound-only sent messages (not self-sends)
  if (email.labels.includes('DRAFT')) {
    console.log(`Skipping ${email.messageId} (draft)`)
    return
  }
  if (email.labels.includes('SENT') && !email.labels.includes('INBOX')) {
    console.log(`Skipping ${email.messageId} (sent, not inbox)`)
    return
  }

  // Skip already-processed messages
  if (await isAlreadyProcessed(pgClient, email.messageId)) {
    console.log(`Skipping ${email.messageId} (already processed)`)
    return
  }

  console.log(`Triaging: "${email.subject}" from ${email.from}`)

  const decision = await classifyEmail(email, {
    anthropicBaseUrl,
    anthropicApiKey,
    newsletterConfig,
  })

  console.log(`  → ${decision.category} (${decision.confidence}) — ${decision.reason}`)

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
      messageId: email.messageId,
      category: decision.category,
      subject: email.subject,
      from: email.from,
      draftCreated: result.draftCreated,
      archived: result.archived,
    }),
  )
}

const poller = new GmailPoller({
  gmail,
  redis: redisClient,
  onNewMessage: handleNewMessage,
})

const app = createApp(pgClient, redisClient, () => isPostgresConnected)

pgClient.on('error', (err: Error) => {
  console.error('PostgreSQL error:', err)
  isPostgresConnected = false
})

async function start() {
  await pgClient.connect()
  await redisClient.connect()
  isPostgresConnected = true
  console.log('Connected to PostgreSQL and Redis')

  await createSchema(pgClient)

  await poller.start()

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`Email triage agent running on port ${PORT}`)
}

start().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
