export const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
  },
  parents: {
    parent1Phone: process.env.PARENT_1_PHONE!,
    parent2Phone: process.env.PARENT_2_PHONE!,
  },
  google: {
    credentials: process.env.GOOGLE_CALENDAR_CREDENTIALS!,
    parent1CalendarId: process.env.PARENT_1_CALENDAR_ID!,
    parent2CalendarId: process.env.PARENT_2_CALENDAR_ID!,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  timezone: 'America/Los_Angeles' as const,
  port: parseInt(process.env.PORT || '3002', 10),
  planGeneration: {
    cronSchedule: process.env.PLAN_CRON_SCHEDULE || '0 7 * * *', // 7am daily
    weeklyLookaheadSchedule: process.env.WEEKLY_CRON_SCHEDULE || '0 18 * * 0', // 6pm Sunday
    tightTransitionMinutes: 15,
  },
} as const

const REQUIRED_ENV_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'PARENT_1_PHONE',
  'PARENT_2_PHONE',
  'GOOGLE_CALENDAR_CREDENTIALS',
  'PARENT_1_CALENDAR_ID',
  'PARENT_2_CALENDAR_ID',
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
]

export function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}
