import type { TriageCategory } from '../triage/types'

export interface BriefConfig {
  /** Cron-style hours to send briefs (24h format), e.g. [7, 15] for 7 AM and 3 PM */
  scheduleHours: number[]
  /** Timezone for schedule, e.g. 'Europe/Copenhagen' */
  timezone: string
  /** Email address to send the brief to (defaults to the Gmail account's own address) */
  recipientEmail?: string
}

export const BRIEF_CATEGORIES: TriageCategory[] = [
  'informational',
  'newsletter_valued',
  'newsletter_noise',
  'notification',
  'promotion',
]

export interface BriefEmail {
  gmailMessageId: string
  fromAddress: string
  subject: string
  category: TriageCategory
  reason: string
  processedAt: Date
}

export interface BriefSection {
  title: string
  icon: string
  emails: BriefEmail[]
}

export interface GeneratedBrief {
  subject: string
  htmlBody: string
  emailCount: number
  periodStart: Date
  periodEnd: Date
}

export const SECTION_CONFIG: Record<string, { title: string; icon: string }> = {
  newsletter_valued: { title: 'Worth Reading', icon: '📰' },
  informational: { title: 'FYI', icon: '💡' },
  notification: { title: 'Notifications', icon: '🔔' },
  newsletter_noise: { title: 'Skimmed', icon: '📋' },
  promotion: { title: 'Promotions', icon: '🏷️' },
}
