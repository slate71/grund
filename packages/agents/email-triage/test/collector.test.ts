import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectBriefEmails } from '../src/brief/collector'
import { BRIEF_CATEGORIES } from '../src/brief/types'

// Mock pg Client
function createMockClient(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  }
}

describe('collectBriefEmails', () => {
  const since = new Date('2025-03-10T07:00:00Z')
  const until = new Date('2025-03-10T15:00:00Z')

  it('queries for brief-eligible categories within the time window', async () => {
    const mockClient = createMockClient([])
    await collectBriefEmails(mockClient as never, since, until)

    expect(mockClient.query).toHaveBeenCalledTimes(1)
    const [sql, params] = mockClient.query.mock.calls[0]

    // Check the time window params
    expect(params[0]).toBe(since.toISOString())
    expect(params[1]).toBe(until.toISOString())

    // Check that all brief categories are included
    for (const cat of BRIEF_CATEGORIES) {
      expect(params).toContain(cat)
    }

    // Should NOT include urgent/action categories
    expect(params).not.toContain('urgent_action')
    expect(params).not.toContain('action_required')
    expect(sql).toContain('category IN')
  })

  it('maps database rows to BriefEmail objects', async () => {
    const mockClient = createMockClient([
      {
        gmail_message_id: 'msg-1',
        from_address: 'news@example.com',
        subject: 'Weekly Update',
        category: 'newsletter_valued',
        reason: 'Matched newsletter seed list',
        processed_at: '2025-03-10T10:30:00Z',
      },
      {
        gmail_message_id: 'msg-2',
        from_address: 'noreply@github.com',
        subject: 'PR merged',
        category: 'notification',
        reason: 'Automated GitHub notification',
        processed_at: '2025-03-10T11:00:00Z',
      },
    ])

    const result = await collectBriefEmails(mockClient as never, since, until)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      gmailMessageId: 'msg-1',
      fromAddress: 'news@example.com',
      subject: 'Weekly Update',
      category: 'newsletter_valued',
      reason: 'Matched newsletter seed list',
      processedAt: new Date('2025-03-10T10:30:00Z'),
    })
    expect(result[1].category).toBe('notification')
  })

  it('returns empty array when no emails match', async () => {
    const mockClient = createMockClient([])
    const result = await collectBriefEmails(mockClient as never, since, until)
    expect(result).toEqual([])
  })
})
