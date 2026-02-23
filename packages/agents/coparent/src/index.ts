import Fastify from 'fastify'
import cron from 'node-cron'
import { validateEnvironment, config } from './config'
import { registerWebhook } from './sms/webhook'
import { generateAndSendDailyPlan, generateAndSendWeeklyLookahead } from './planner/generate'
import { todayPT } from './utils/time'

// Validate required environment variables
validateEnvironment()

const app = Fastify({ logger: true })

// --- Health Check ---
app.get('/health', async () => ({
  status: 'healthy',
  uptime: process.uptime(),
  agent: 'coparent-logistics',
}))

// --- Manual Trigger Endpoints (for testing/debugging) ---
app.post('/trigger/daily-plan', async (request, reply) => {
  const { date } = (request.body as { date?: string }) || {}
  const plan = await generateAndSendDailyPlan(date || todayPT())
  return { success: !!plan, planId: plan?.id }
})

app.post('/trigger/weekly-lookahead', async () => {
  await generateAndSendWeeklyLookahead()
  return { success: true }
})

// --- Register Twilio Webhook ---
registerWebhook(app)

// --- Cron Jobs ---

// Daily plan generation at 7am PT
cron.schedule(
  config.planGeneration.cronSchedule,
  async () => {
    console.log('Running daily plan generation...')
    try {
      await generateAndSendDailyPlan()
    } catch (err) {
      console.error('Daily plan generation failed:', err)
    }
  },
  { timezone: config.timezone },
)

// Weekly lookahead every Sunday at 6pm PT
cron.schedule(
  config.planGeneration.weeklyLookaheadSchedule,
  async () => {
    console.log('Running weekly lookahead...')
    try {
      await generateAndSendWeeklyLookahead()
    } catch (err) {
      console.error('Weekly lookahead failed:', err)
    }
  },
  { timezone: config.timezone },
)

// --- Start Server ---
async function start() {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`Co-parent logistics agent running on port ${config.port}`)
    console.log(`Daily plan cron: ${config.planGeneration.cronSchedule} (${config.timezone})`)
    console.log(`Weekly lookahead cron: ${config.planGeneration.weeklyLookaheadSchedule} (${config.timezone})`)
    console.log(`Twilio webhook: POST /webhooks/twilio/inbound`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
