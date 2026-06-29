import { describe, it, expect } from 'vitest'
import { buildSimplefinRequest } from './simplefin'

describe('buildSimplefinRequest', () => {
  const accessUrl = 'https://user:pass@bridge.simplefin.org/simplefin'

  it('extracts Basic-auth from embedded creds and strips userinfo from the URL', () => {
    const { url, authHeader } = buildSimplefinRequest(accessUrl, 'accounts', '/simplefin/accounts')
    expect(authHeader).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
    expect(url).toBe('https://bridge.simplefin.org/simplefin/accounts')
  })

  it("appends the path tail to the access URL's existing path", () => {
    const { url } = buildSimplefinRequest(accessUrl, 'accounts', '/simplefin/accounts')
    expect(new URL(url).pathname).toBe('/simplefin/accounts')
  })

  it('forwards query params (start-date)', () => {
    const { url } = buildSimplefinRequest(
      accessUrl,
      'accounts',
      '/simplefin/accounts?start-date=1700000000',
    )
    expect(new URL(url).searchParams.get('start-date')).toBe('1700000000')
  })
})
