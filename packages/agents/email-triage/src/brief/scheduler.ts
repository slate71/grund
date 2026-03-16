import { Client } from 'pg'
import type { GmailClient } from '../gmail/client'
import type { BriefConfig, GeneratedBrief } from './types'
import { collectBriefEmails } from './collector'
import { renderBrief } from './renderer'
import { sendBrief } from './sender'
import type { Logger } from '@grund/logger'

export interface BriefSchedulerDeps {
  pgClient: Client
  gmail: GmailClient
  recipientEmail: string
  config: BriefConfig
  log: Logger
}

export function startBriefScheduler(deps: BriefSchedulerDeps): { stop: () => void } {
  const { log } = deps
  let timer: ReturnType<typeof setInterval>

  async function tick() {
    const now = getNowInTimezone(deps.config.timezone)
    const hour = now.getHours()
    const minute = now.getMinutes()

    // Only fire in the first 5 minutes of a scheduled hour
    if (!deps.config.scheduleHours.includes(hour) || minute > 4) return

    // Check DB to prevent duplicates (survives container restarts)
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${hour}`
    const existing = await deps.pgClient.query(
      `SELECT 1 FROM daily_briefs WHERE subject LIKE $1 AND sent_at > NOW() - INTERVAL '1 hour'`,
      [`%${key}%`],
    )
    if ((existing.rowCount ?? 0) > 0) return

    try {
      const brief = await generateAndSendBrief(deps, now)
      if (brief) {
        log.info({ emailCount: brief.emailCount, subject: brief.subject }, 'Brief sent')
        await recordBrief(deps.pgClient, brief)
      }
    } catch (err) {
      log.error({ err }, 'Failed to send brief')
    }
  }

  // Check every 60 seconds
  timer = setInterval(tick, 60_000)
  tick()

  return {
    stop: () => clearInterval(timer),
  }
}

async function generateAndSendBrief(
  deps: BriefSchedulerDeps,
  now: Date,
): Promise<GeneratedBrief | null> {
  const { log } = deps
  const periodStart = getPreviousScheduledTime(now, deps.config)
  const periodEnd = now

  log.info(
    { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
    'Collecting emails for brief',
  )

  const emails = await collectBriefEmails(deps.pgClient, periodStart, periodEnd)

  log.info({ count: emails.length }, 'Emails found for brief')

  if (emails.length === 0) {
    return null
  }

  const brief = renderBrief(emails, periodStart, periodEnd)

  await sendBrief(deps.gmail, deps.recipientEmail, brief)

  return brief
}

function getPreviousScheduledTime(now: Date, config: BriefConfig): Date {
  const hours = [...config.scheduleHours].sort((a, b) => a - b)
  const currentHour = now.getHours()

  let prevHour: number | undefined
  let dayOffset = 0

  for (let i = hours.length - 1; i >= 0; i--) {
    if (hours[i] < currentHour) {
      prevHour = hours[i]
      break
    }
  }

  if (prevHour === undefined) {
    prevHour = hours[hours.length - 1]
    dayOffset = -1
  }

  const prev = new Date(now)
  prev.setDate(prev.getDate() + dayOffset)
  prev.setHours(prevHour, 0, 0, 0)
  return prev
}

async function recordBrief(pgClient: Client, brief: GeneratedBrief): Promise<void> {
  await pgClient.query(
    `INSERT INTO daily_briefs (period_start, period_end, email_count, subject, sent_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [
      brief.periodStart.toISOString(),
      brief.periodEnd.toISOString(),
      brief.emailCount,
      brief.subject,
    ],
  )
}

function getNowInTimezone(timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
}
