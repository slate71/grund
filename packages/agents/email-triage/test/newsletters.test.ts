import { describe, it, expect } from 'vitest'
import { matchNewsletter, type NewsletterConfig } from '../src/config/newsletters'

const config: NewsletterConfig = {
  valued: {
    domains: ['stratechery.com', 'notboring.co'],
    senders: ['dan@tldrnewsletter.com'],
    patterns: ['^\\[TLDR\\]', 'Weekly Digest'],
  },
}

describe('matchNewsletter', () => {
  it('matches by domain', () => {
    expect(matchNewsletter('ben@stratechery.com', 'Some post', config)).toBe('newsletter_valued')
  })

  it('matches by sender', () => {
    expect(matchNewsletter('dan@tldrnewsletter.com', 'TLDR issue', config)).toBe(
      'newsletter_valued',
    )
  })

  it('matches by subject pattern', () => {
    expect(matchNewsletter('unknown@example.com', '[TLDR] Tech news', config)).toBe(
      'newsletter_valued',
    )
  })

  it('matches Weekly Digest pattern', () => {
    expect(matchNewsletter('noreply@service.com', 'Your Weekly Digest', config)).toBe(
      'newsletter_valued',
    )
  })

  it('is case-insensitive for domains', () => {
    expect(matchNewsletter('BEN@STRATECHERY.COM', 'Post', config)).toBe('newsletter_valued')
  })

  it('returns null for non-matching email', () => {
    expect(matchNewsletter('random@example.com', 'Hello there', config)).toBeNull()
  })
})
