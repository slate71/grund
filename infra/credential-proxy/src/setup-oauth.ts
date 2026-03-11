import { createServer } from 'node:http'
import { saveTokens, type GmailTokens } from './oauth'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
]

const REDIRECT_PORT = 3456
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables')
    console.error('Create credentials at https://console.cloud.google.com/apis/credentials')
    process.exit(1)
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  console.log('\nOpen this URL in your browser:\n')
  console.log(authUrl.toString())
  console.log('\nWaiting for callback...')

  const code = await waitForAuthCode()

  console.log('Exchanging code for tokens...')
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
    console.error('Token exchange failed:', await res.text())
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

  saveTokens(tokens)
  console.log('\nTokens saved to ~/.config/grund/gmail-tokens.json')
  console.log('Setup complete.')
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

main().catch(console.error)
