import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const DOCKER_CONFIG_DIR = '/config'
const LOCAL_CONFIG_DIR = resolve(homedir(), '.config/grund')
const CONFIG_DIR = existsSync(DOCKER_CONFIG_DIR) ? DOCKER_CONFIG_DIR : LOCAL_CONFIG_DIR

const ACCESS_FILE = resolve(CONFIG_DIR, 'simplefin-access.json')

interface AccessStore {
  accessUrl: string
}

export function loadAccessUrl(): string | null {
  if (!existsSync(ACCESS_FILE)) return null
  const raw = readFileSync(ACCESS_FILE, 'utf-8')
  return (JSON.parse(raw) as AccessStore).accessUrl
}

export function saveAccessUrl(accessUrl: string): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(ACCESS_FILE, JSON.stringify({ accessUrl } satisfies AccessStore, null, 2))
}

// Exchange a one-time SimpleFIN setup token for a long-lived access URL.
// The token is base64 of a claim URL; POSTing to it returns the access URL
// (with embedded Basic-auth credentials) as plain text.
// https://www.simplefin.org/protocol.html
export async function claimSetupToken(setupToken: string): Promise<string> {
  const claimUrl = Buffer.from(setupToken.trim(), 'base64').toString('utf-8')
  const res = await fetch(claimUrl, { method: 'POST' })
  if (!res.ok) {
    throw new Error(`SimpleFIN claim failed: ${res.status} ${await res.text()}`)
  }
  return (await res.text()).trim()
}

// Turn the stored access URL into a forwardable request: the embedded
// credentials become an Authorization header (Bun's fetch ignores userinfo in
// the URL), and the requested path tail + incoming query are appended to the
// access URL's own path (e.g. `/simplefin` + `accounts` -> `/simplefin/accounts`).
export function buildSimplefinRequest(
  accessUrl: string,
  pathTail: string,
  requestUrl: string,
): { url: string; authHeader: string } {
  const base = new URL(accessUrl)
  const authHeader = `Basic ${Buffer.from(`${base.username}:${base.password}`).toString('base64')}`
  base.username = ''
  base.password = ''

  const basePath = base.pathname.replace(/\/$/, '')
  const target = new URL(`${base.origin}${basePath}/${pathTail}`)

  const qIndex = requestUrl.indexOf('?')
  if (qIndex !== -1) {
    const params = new URLSearchParams(requestUrl.slice(qIndex + 1))
    for (const [key, value] of params) {
      target.searchParams.set(key, value)
    }
  }

  return { url: target.toString(), authHeader }
}
