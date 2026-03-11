import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const DOCKER_CONFIG_DIR = '/config'
const LOCAL_CONFIG_DIR = resolve(homedir(), '.config/grund')
const CONFIG_DIR = existsSync(DOCKER_CONFIG_DIR) ? DOCKER_CONFIG_DIR : LOCAL_CONFIG_DIR
const TOKENS_PATH = resolve(CONFIG_DIR, 'gmail-tokens.json')

export interface GmailTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expiry_date: number
  client_id: string
  client_secret: string
}

export function loadTokens(): GmailTokens | null {
  if (!existsSync(TOKENS_PATH)) return null
  const raw = readFileSync(TOKENS_PATH, 'utf-8')
  return JSON.parse(raw) as GmailTokens
}

export function saveTokens(tokens: GmailTokens): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
}

export async function refreshAccessToken(tokens: GmailTokens): Promise<GmailTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: tokens.client_id,
      client_secret: tokens.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    token_type: string
  }

  const updated: GmailTokens = {
    ...tokens,
    access_token: data.access_token,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
  }

  saveTokens(updated)
  return updated
}

export async function getValidAccessToken(tokens: GmailTokens): Promise<string> {
  if (Date.now() < tokens.expiry_date - 60_000) {
    return tokens.access_token
  }
  console.log('Refreshing Gmail access token...')
  const refreshed = await refreshAccessToken(tokens)
  return refreshed.access_token
}
