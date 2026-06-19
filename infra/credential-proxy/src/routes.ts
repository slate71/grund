import type { FastifyInstance } from 'fastify'
import { loadTokens, getValidAccessToken, listAccounts, type GmailTokens } from './oauth'
import {
  loadSimpleFinCredentials,
  parseAccessUrl,
  isSimpleFinConfigured,
  type SimpleFinCredentials,
} from './simplefin'
import { log } from './logger'

export function registerRoutes(app: FastifyInstance) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicApiKey) {
    log.error('ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  const tokenCache = new Map<string, GmailTokens>()

  function getTokens(account: string): GmailTokens | null {
    let tokens = tokenCache.get(account) ?? null
    if (!tokens) {
      tokens = loadTokens(account)
      if (tokens) tokenCache.set(account, tokens)
    }
    return tokens
  }

  const accounts = listAccounts()
  if (accounts.length === 0) {
    log.warn('No Gmail accounts configured. Run `bun run setup` first.')
  } else {
    log.info({ accounts }, 'Gmail accounts configured')
  }

  app.all('/anthropic/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*']
    const targetUrl = `https://api.anthropic.com/${path}`

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': (request.headers['anthropic-version'] as string) || '2023-06-01',
    }

    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    })

    const body = await res.text()
    log.info({ method: request.method, path, status: res.status }, 'Anthropic proxy')

    reply.code(res.status)
    reply.header('content-type', 'application/json')
    return reply.send(body)
  })

  app.all('/gmail/:account/*', async (request, reply) => {
    const { account } = request.params as { account: string; '*': string }
    const path = (request.params as { '*': string })['*']

    const tokens = getTokens(account)
    if (!tokens) {
      reply.code(503)
      return { error: `Gmail tokens not configured for account "${account}". Run setup-oauth first.` }
    }

    const accessToken = await getValidAccessToken(account, tokens)
    const url = new URL(`https://gmail.googleapis.com/gmail/${path}`)

    const rawUrl = request.url
    const qIndex = rawUrl.indexOf('?')
    if (qIndex !== -1) {
      const params = new URLSearchParams(rawUrl.slice(qIndex + 1))
      for (const [key, value] of params) {
        url.searchParams.set(key, value)
      }
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
    }
    if (request.method !== 'GET') {
      headers['content-type'] = 'application/json'
    }

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    })

    const body = await res.text()
    log.info({ account, method: request.method, path: url.pathname, status: res.status }, 'Gmail proxy')

    reply.code(res.status)
    reply.header('content-type', 'application/json')
    return reply.send(body)
  })

  // SimpleFIN: forward read requests (e.g. /simplefin/accounts) to the user's
  // SimpleFIN access URL, injecting its Basic auth so the credential never
  // leaves the proxy. The access URL is cached after first load.
  let simpleFinCache: SimpleFinCredentials | null = null

  function getSimpleFinCredentials(): SimpleFinCredentials | null {
    if (!simpleFinCache) simpleFinCache = loadSimpleFinCredentials()
    return simpleFinCache
  }

  if (isSimpleFinConfigured()) {
    log.info('SimpleFIN configured')
  } else {
    log.warn('SimpleFIN not configured. Run `bun run setup-simplefin` to enable finance sync.')
  }

  app.all('/simplefin/*', async (request, reply) => {
    const path = (request.params as { '*': string })['*']

    const creds = getSimpleFinCredentials()
    if (!creds) {
      reply.code(503)
      return { error: 'SimpleFIN not configured. Run `bun run setup-simplefin` first.' }
    }

    const { baseUrl, authHeader } = parseAccessUrl(creds.access_url)
    const url = new URL(`${baseUrl}/${path}`)

    const rawUrl = request.url
    const qIndex = rawUrl.indexOf('?')
    if (qIndex !== -1) {
      const params = new URLSearchParams(rawUrl.slice(qIndex + 1))
      for (const [key, value] of params) {
        url.searchParams.set(key, value)
      }
    }

    const res = await fetch(url.toString(), {
      method: request.method,
      headers: { authorization: authHeader },
    })

    const body = await res.text()
    log.info({ method: request.method, path, status: res.status }, 'SimpleFIN proxy')

    reply.code(res.status)
    reply.header('content-type', 'application/json')
    return reply.send(body)
  })

  app.get('/accounts', async () => {
    return { accounts: listAccounts() }
  })

  app.get('/health', async () => {
    return {
      status: 'healthy',
      accounts: listAccounts(),
      anthropicConfigured: true,
      simplefinConfigured: isSimpleFinConfigured(),
    }
  })
}
