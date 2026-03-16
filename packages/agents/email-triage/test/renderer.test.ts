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

  it('calls Claude and returns plain text brief', async () => {
    const mockText = 'Worth Reading (1)\nStratechery had a great piece on...\n  - news@stratechery.com | Stratechery Weekly'
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: mockText }] }),
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

    const result = await renderBrief(emails, new Date('2025-03-10T07:00:00Z'), new Date('2025-03-10T10:00:00Z'), opts)

    expect(result.emailCount).toBe(1)
    expect(result.subject).toContain('1 email')
    expect(result.subject).not.toContain('1 emails')
    expect(result.body).toContain('Stratechery')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

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
