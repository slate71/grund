import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const DOCKER_CONFIG_DIR = '/config'
const LOCAL_CONFIG_DIR = resolve(homedir(), '.config/grund')
const CONFIG_DIR = existsSync(DOCKER_CONFIG_DIR) ? DOCKER_CONFIG_DIR : LOCAL_CONFIG_DIR

export interface GmailTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expiry_date: number
  client_id: string
  client_secret: string
}

function tokensPath(account: string): string {
  return resolve(CONFIG_DIR, `gmail-tokens-${account}.json`)
}

export function loadTokens(account: string): GmailTokens | null {
  const path = tokensPath(account)
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as GmailTokens
}

export function saveTokens(account: string, tokens: GmailTokens): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(tokensPath(account), JSON.stringify(tokens, null, 2))
}

export function listAccounts(): string[] {
  if (!existsSync(CONFIG_DIR)) return []
  return readdirSync(CONFIG_DIR)
    .filter((f) => f.startsWith('gmail-tokens-') && f.endsWith('.json'))
    .map((f) => f.replace('gmail-tokens-', '').replace('.json', ''))
}

export async function refreshAccessToken(
  account: string,
  tokens: GmailTokens,
): Promise<GmailTokens> {
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
    throw new Error(`Token refresh failed for ${account}: ${res.status} ${await res.text()}`)
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

  saveTokens(account, updated)
  return updated
}

export async function getValidAccessToken(
  account: string,
  tokens: GmailTokens,
): Promise<string> {
  if (Date.now() < tokens.expiry_date - 60_000) {
    return tokens.access_token
  }
  console.log(`Refreshing Gmail access token for ${account}...`)
  const refreshed = await refreshAccessToken(account, tokens)
  return refreshed.access_token
}
