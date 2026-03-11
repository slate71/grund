import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyEmail } from '../src/triage/classifier'
import type { ParsedEmail } from '../src/gmail/types'
import type { NewsletterConfig } from '../src/config/newsletters'

const newsletterConfig: NewsletterConfig = {
  valued: {
    domains: ['stratechery.com'],
    senders: ['dan@tldrnewsletter.com'],
    patterns: ['^\\[TLDR\\]'],
  },
}

const baseEmail: ParsedEmail = {
  messageId: 'msg-1',
  threadId: 'thread-1',
  from: 'someone@example.com',
  to: 'me@example.com',
  subject: 'Hello',
  body: 'This is a test email.',
  labels: ['INBOX'],
  date: '2025-03-10T10:00:00Z',
}

describe('classifyEmail', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns newsletter_valued for matching sender without API call', async () => {
    const email = { ...baseEmail, from: 'ben@stratechery.com' }
    const result = await classifyEmail(email, {
      anthropicBaseUrl: 'http://localhost:9876/anthropic',
      anthropicApiKey: 'placeholder',
      newsletterConfig,
    })

    expect(result.category).toBe('newsletter_valued')
    expect(result.confidence).toBe(1.0)
    expect(result.reason).toBe('Matched newsletter seed list')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('calls Anthropic API for non-newsletter emails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              type: 'tool_use',
              name: 'classify_email',
              input: {
                category: 'notification',
                confidence: 0.95,
                reason: 'Automated GitHub notification',
                shouldDraftReply: false,
                suggestedLabels: [],
                archiveAfter: true,
              },
            },
          ],
        }),
    })

    const email = { ...baseEmail, from: 'noreply@github.com', subject: 'PR merged' }
    const result = await classifyEmail(email, {
      anthropicBaseUrl: 'http://localhost:9876/anthropic',
      anthropicApiKey: 'placeholder',
      newsletterConfig,
    })

    expect(result.category).toBe('notification')
    expect(result.confidence).toBe(0.95)
    expect(result.archiveAfter).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('throws on API error', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    await expect(
      classifyEmail(baseEmail, {
        anthropicBaseUrl: 'http://localhost:9876/anthropic',
        anthropicApiKey: 'placeholder',
        newsletterConfig,
      }),
    ).rejects.toThrow('Anthropic API error: 500')
  })

  it('throws when no tool_use in response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'I classified it' }] }),
    })

    await expect(
      classifyEmail(baseEmail, {
        anthropicBaseUrl: 'http://localhost:9876/anthropic',
        anthropicApiKey: 'placeholder',
        newsletterConfig,
      }),
    ).rejects.toThrow('No tool_use in classification response')
  })
})
