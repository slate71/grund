import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeActions, type ActionContext } from '../src/triage/actions'
import type { ParsedEmail } from '../src/gmail/types'
import type { TriageDecision } from '../src/triage/types'

const email: ParsedEmail = {
  messageId: 'msg-1',
  threadId: 'thread-1',
  from: 'sender@example.com',
  to: 'me@example.com',
  subject: 'Test email',
  body: 'Hello there.',
  labels: ['INBOX'],
  date: '2025-03-10T10:00:00Z',
}

function createMockContext(): ActionContext {
  return {
    gmail: {
      getOrCreateLabel: vi.fn().mockResolvedValue('label-abc'),
      modifyMessage: vi.fn().mockResolvedValue(undefined),
      createDraft: vi.fn().mockResolvedValue('draft-1'),
    } as unknown as ActionContext['gmail'],
    anthropicBaseUrl: 'http://localhost:9876/anthropic',
    anthropicApiKey: 'placeholder',
  }
}

describe('executeActions', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('applies labels and archives', async () => {
    const ctx = createMockContext()
    const decision: TriageDecision = {
      category: 'newsletter_valued',
      confidence: 1.0,
      reason: 'Matched seed list',
      shouldDraftReply: false,
      suggestedLabels: ['Reading List'],
      archiveAfter: true,
    }

    const result = await executeActions(email, decision, ctx)

    expect(ctx.gmail.getOrCreateLabel).toHaveBeenCalledWith('Reading List')
    expect(ctx.gmail.modifyMessage).toHaveBeenCalledWith('msg-1', ['label-abc'], ['INBOX'])
    expect(result.labelsApplied).toEqual(['Reading List'])
    expect(result.archived).toBe(true)
    expect(result.draftCreated).toBe(false)
  })

  it('creates draft for urgent emails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: 'Thanks, I will review this by EOD.' }],
        }),
    })

    const ctx = createMockContext()
    const decision: TriageDecision = {
      category: 'urgent_action',
      confidence: 0.9,
      reason: 'Direct request with deadline',
      shouldDraftReply: true,
      suggestedLabels: ['Urgent'],
      archiveAfter: false,
    }

    const result = await executeActions(email, decision, ctx)

    expect(result.draftCreated).toBe(true)
    expect(ctx.gmail.createDraft).toHaveBeenCalled()
  })

  it('does not archive when archiveAfter is false', async () => {
    const ctx = createMockContext()
    const decision: TriageDecision = {
      category: 'informational',
      confidence: 0.8,
      reason: 'FYI email',
      shouldDraftReply: false,
      suggestedLabels: [],
      archiveAfter: false,
    }

    const result = await executeActions(email, decision, ctx)

    expect(result.archived).toBe(false)
    // No labels and no archive = no modifyMessage call
    expect(ctx.gmail.modifyMessage).not.toHaveBeenCalled()
  })
})
