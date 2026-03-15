import { createServer } from 'node:http'
import { saveTokens, type GmailTokens } from './oauth'
import { log } from './logger'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
]

const REDIRECT_PORT = 3456
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

async function main() {
  const account = process.argv[2]
  if (!account) {
    log.error('Usage: bun run setup-oauth.ts <account-name>')
    log.error('Example: bun run setup-oauth.ts work')
    log.error('Example: bun run setup-oauth.ts personal')
    process.exit(1)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    log.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables')
    process.exit(1)
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  log.info({ account }, 'Setting up Gmail OAuth')
  log.info({ url: authUrl.toString() }, 'Open this URL in your browser')
  log.info('Waiting for callback...')

  const code = await waitForAuthCode()

  log.info('Exchanging code for tokens...')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    log.error({ status: res.status, body: await res.text() }, 'Token exchange failed')
    process.exit(1)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
  }

  const tokens: GmailTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
    client_id: clientId,
    client_secret: clientSecret,
  }

  saveTokens(account, tokens)
  log.info({ account }, 'Tokens saved. Setup complete.')
  process.exit(0)
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`<h1>Error: ${error}</h1><p>You can close this tab.</p>`)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>Authorization successful</h1><p>You can close this tab.</p>')
        server.close()
        resolve(code)
        return
      }

      res.writeHead(404)
      res.end()
    })

    server.listen(REDIRECT_PORT)
  })
}

main().catch((err) => log.error({ err }, 'Setup failed'))
