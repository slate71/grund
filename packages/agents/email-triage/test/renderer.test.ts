import { describe, it, expect } from 'vitest'
import { renderBrief } from '../src/brief/renderer'
import type { BriefEmail } from '../src/brief/types'

describe('renderBrief', () => {
  it('renders a plain text brief with sections', () => {
    const emails: BriefEmail[] = [
      {
        gmailMessageId: 'msg-1',
        fromAddress: 'news@stratechery.com',
        subject: 'Stratechery Weekly',
        category: 'newsletter_valued',
        reason: 'Matched newsletter seed list',
        processedAt: new Date('2025-03-10T09:00:00Z'),
      },
      {
        gmailMessageId: 'msg-2',
        fromAddress: 'noreply@github.com',
        subject: 'PR merged',
        category: 'notification',
        reason: 'GitHub notification',
        processedAt: new Date('2025-03-10T10:00:00Z'),
      },
    ]
    const periodStart = new Date('2025-03-10T07:00:00Z')
    const periodEnd = new Date('2025-03-10T10:00:00Z')

    const result = renderBrief(emails, periodStart, periodEnd)

    expect(result.emailCount).toBe(2)
    expect(result.subject).toContain('2 emails')
    expect(result.body).toContain('Worth Reading')
    expect(result.body).toContain('Stratechery Weekly')
    expect(result.body).toContain('Notifications')
    expect(result.body).toContain('PR merged')
    expect(result.body).toContain('Grund Email Triage')
  })

  it('handles single email grammar', () => {
    const emails: BriefEmail[] = [
      {
        gmailMessageId: 'msg-1',
        fromAddress: 'news@example.com',
        subject: 'Update',
        category: 'informational',
        reason: 'FYI',
        processedAt: new Date('2025-03-10T09:00:00Z'),
      },
    ]

    const result = renderBrief(emails, new Date('2025-03-10T07:00:00Z'), new Date('2025-03-10T10:00:00Z'))

    expect(result.subject).toContain('1 email')
    expect(result.subject).not.toContain('1 emails')
  })
})
