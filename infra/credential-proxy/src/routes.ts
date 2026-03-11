import type { FastifyInstance } from 'fastify'
import { loadTokens, getValidAccessToken, type GmailTokens } from './oauth'

export function registerRoutes(app: FastifyInstance) {
  let tokens: GmailTokens | null = loadTokens()
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicApiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  if (!tokens) {
    console.warn('WARNING: No Gmail tokens found. Run `bun run setup` first.')
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

    reply.code(res.status)
    for (const [key, value] of res.headers.entries()) {
      if (key.toLowerCase() !== 'transfer-encoding') {
        reply.header(key, value)
      }
    }
    const body = await res.text()
    return reply.send(body)
  })

  // Gmail proxy: /gmail/* → gmail.googleapis.com/*
  app.all('/gmail/*', async (request, reply) => {
    if (!tokens) {
      tokens = loadTokens()
      if (!tokens) {
        reply.code(503)
        return { error: 'Gmail tokens not configured. Run setup-oauth first.' }
      }
    }

    const accessToken = await getValidAccessToken(tokens)
    const path = (request.params as { '*': string })['*']
    const url = new URL(`https://gmail.googleapis.com/${path}`)

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

    reply.code(res.status)
    for (const [key, value] of res.headers.entries()) {
      if (key.toLowerCase() !== 'transfer-encoding') {
        reply.header(key, value)
      }
    }
    const body = await res.text()
    return reply.send(body)
  })

  // Health check
  app.get('/health', async () => {
    return {
      status: 'healthy',
      gmailConfigured: tokens !== null,
      anthropicConfigured: true,
    }
  })
}
