import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderBrief } from '../src/brief/renderer'
import type { BriefEmail } from '../src/brief/types'

const opts = {
  anthropicBaseUrl: 'http://localhost:9876/anthropic',
  anthropicApiKey: 'placeholder',
}

describe('renderBrief', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders an empty brief without calling Claude', async () => {
    const periodStart = new Date('2025-03-10T07:00:00Z')
    const periodEnd = new Date('2025-03-10T10:00:00Z')

    const result = await renderBrief([], periodStart, periodEnd, opts)

    expect(result.emailCount).toBe(0)
    expect(result.subject).toContain('Inbox Zero')
    expect(result.htmlBody).toContain('Nothing to report')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('calls Claude to generate HTML for non-empty briefs', async () => {
    const mockHtml = '<div><h2>Worth Reading</h2><p>1 newsletter</p></div>'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: mockHtml }],
        }),
    })

    const emails: BriefEmail[] = [
      {
        gmailMessageId: 'msg-1',
        fromAddress: 'news@stratechery.com',
        subject: 'Stratechery Weekly',
        category: 'newsletter_valued',
        reason: 'Matched newsletter seed list',
        processedAt: new Date('2025-03-10T09:00:00Z'),
      },
    ]
    const periodStart = new Date('2025-03-10T07:00:00Z')
    const periodEnd = new Date('2025-03-10T10:00:00Z')

    const result = await renderBrief(emails, periodStart, periodEnd, opts)

    expect(result.emailCount).toBe(1)
    expect(result.subject).toContain('1 email')
    expect(result.htmlBody).toContain('Worth Reading')
    expect(result.htmlBody).toContain('Grund Email Triage')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    // Verify Claude request includes the email data
    const callBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    )
    expect(callBody.messages[0].content).toContain('Stratechery Weekly')
    expect(callBody.messages[0].content).toContain('Worth Reading')
  })

  it('throws on Claude API error', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    const emails: BriefEmail[] = [
      {
        gmailMessageId: 'msg-1',
        fromAddress: 'noreply@github.com',
        subject: 'PR merged',
        category: 'notification',
        reason: 'GitHub notification',
        processedAt: new Date('2025-03-10T09:00:00Z'),
      },
    ]

    await expect(
      renderBrief(emails, new Date(), new Date(), opts),
    ).rejects.toThrow('Anthropic API error: 500')
  })
})
