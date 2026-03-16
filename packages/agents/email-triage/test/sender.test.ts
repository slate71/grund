import { describe, it, expect, vi } from 'vitest'
import { sendBrief } from '../src/brief/sender'
import type { GeneratedBrief } from '../src/brief/types'

describe('sendBrief', () => {
  const mockBrief: GeneratedBrief = {
    subject: 'Morning Brief — Monday, March 10 — 5 emails',
    htmlBody: '<div>Brief content</div>',
    emailCount: 5,
    periodStart: new Date('2025-03-10T00:00:00Z'),
    periodEnd: new Date('2025-03-10T07:00:00Z'),
  }

  it('sends the brief as an HTML email via GmailClient.sendMessage', async () => {
    const mockGmail = {
      sendMessage: vi.fn().mockResolvedValue('sent-msg-1'),
    } as never

    const messageId = await sendBrief(mockGmail, 'me@example.com', mockBrief)

    expect(messageId).toBe('sent-msg-1')
    expect(mockGmail.sendMessage).toHaveBeenCalledTimes(1)

    const raw = (mockGmail.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('To: me@example.com')
    expect(decoded).toContain('Subject: Morning Brief')
    expect(decoded).toContain('Content-Type: text/html')
    expect(decoded).toContain('Brief content')
  })

  it('throws on Gmail API error', async () => {
    const mockGmail = {
      sendMessage: vi.fn().mockRejectedValue(new Error('Gmail sendMessage failed: 403 Forbidden')),
    } as never

    await expect(
      sendBrief(mockGmail, 'me@example.com', mockBrief),
    ).rejects.toThrow('Gmail sendMessage failed: 403')
  })
})
