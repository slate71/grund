import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

// SimpleFIN credential storage. Mirrors oauth.ts: secrets live on disk in the
// proxy's config dir and never leave the container. The stored "access URL" is
// the long-lived credential SimpleFIN issues after a one-time claim; it embeds
// HTTP Basic auth, which the proxy injects on each forwarded request.

const DOCKER_CONFIG_DIR = '/config'
const LOCAL_CONFIG_DIR = resolve(homedir(), '.config/grund')
const CONFIG_DIR = existsSync(DOCKER_CONFIG_DIR) ? DOCKER_CONFIG_DIR : LOCAL_CONFIG_DIR

export interface SimpleFinCredentials {
  access_url: string
}

function credentialsPath(): string {
  return resolve(CONFIG_DIR, 'simplefin-access.json')
}

export function loadSimpleFinCredentials(): SimpleFinCredentials | null {
  const path = credentialsPath()
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as SimpleFinCredentials
}

export function saveSimpleFinCredentials(creds: SimpleFinCredentials): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2))
}

export function isSimpleFinConfigured(): boolean {
  return existsSync(credentialsPath())
}

// Split an access URL (https://user:pass@host/path) into the base URL to call
// and the Basic auth header to send, so credentials never appear in logs or the
// outgoing request line.
export function parseAccessUrl(accessUrl: string): { baseUrl: string; authHeader: string } {
  const url = new URL(accessUrl)
  const user = decodeURIComponent(url.username)
  const pass = decodeURIComponent(url.password)
  const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

  url.username = ''
  url.password = ''
  const baseUrl = `${url.origin}${url.pathname}`.replace(/\/$/, '')
  return { baseUrl, authHeader }
}

// One-time exchange: a SimpleFIN setup token is base64 of a claim URL. POSTing to
// that URL returns the access URL used for all subsequent data requests.
export async function claimSetupToken(setupToken: string): Promise<string> {
  const claimUrl = Buffer.from(setupToken.trim(), 'base64').toString('utf-8')
  if (!claimUrl.startsWith('http')) {
    throw new Error('Setup token did not decode to a valid claim URL')
  }

  const res = await fetch(claimUrl, {
    method: 'POST',
    headers: { 'Content-Length': '0' },
  })
  if (!res.ok) {
    throw new Error(`SimpleFIN claim failed: ${res.status} ${await res.text()}`)
  }

  const accessUrl = (await res.text()).trim()
  if (!accessUrl.startsWith('http')) {
    throw new Error('SimpleFIN claim did not return a valid access URL')
  }
  return accessUrl
}
