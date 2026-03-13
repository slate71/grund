import type { FastifyInstance } from 'fastify'
import { loadTokens, getValidAccessToken, listAccounts, type GmailTokens } from './oauth'

export function registerRoutes(app: FastifyInstance) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicApiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  // Cache loaded tokens per account
  const tokenCache = new Map<string, GmailTokens>()

  function getTokens(account: string): GmailTokens | null {
    let tokens = tokenCache.get(account) ?? null
    if (!tokens) {
      tokens = loadTokens(account)
      if (tokens) tokenCache.set(account, tokens)
    }
    return tokens
  }

  // Log configured accounts on startup
  const accounts = listAccounts()
  if (accounts.length === 0) {
    console.warn('WARNING: No Gmail accounts configured. Run `bun run setup` first.')
  } else {
    console.log(`Gmail accounts configured: ${accounts.join(', ')}`)
  }

  // Anthropic proxy: /anthropic/* → api.anthropic.com/*
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
    console.log(`Anthropic proxy: ${request.method} ${path} → ${res.status}`)

    reply.code(res.status)
    reply.header('content-type', 'application/json')
    return reply.send(body)
  })

  // Gmail proxy: /gmail/:account/* → gmail.googleapis.com/gmail/*
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

    // Forward query params
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
    console.log(`Gmail proxy [${account}]: ${request.method} ${url.pathname} → ${res.status}`)

    reply.code(res.status)
    reply.header('content-type', 'application/json')
    return reply.send(body)
  })

  // List configured accounts
  app.get('/accounts', async () => {
    return { accounts: listAccounts() }
  })

  // Health check
  app.get('/health', async () => {
    return {
      status: 'healthy',
      accounts: listAccounts(),
      anthropicConfigured: true,
    }
  })
}
