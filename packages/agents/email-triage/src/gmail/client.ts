import type {
  GmailMessage,
  GmailHistoryResponse,
  GmailProfile,
  GmailPayload,
  GmailPart,
  ParsedEmail,
  WatchResponse,
} from './types'
import { createLogger } from '@grund/logger'

const log = createLogger('email-triage')

export class GmailClient {
  private baseUrl: string
  readonly account: string

  constructor(proxyUrl: string, account: string) {
    this.account = account
    this.baseUrl = `${proxyUrl}/gmail/${account}`
  }

  async getProfile(): Promise<GmailProfile> {
    const res = await fetch(`${this.baseUrl}/v1/users/me/profile`)
    if (!res.ok) throw new Error(`Gmail getProfile failed: ${res.status} ${await res.text()}`)
    return res.json() as Promise<GmailProfile>
  }

  async listHistory(startHistoryId: string): Promise<GmailHistoryResponse> {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: 'messageAdded',
    })
    const res = await fetch(`${this.baseUrl}/v1/users/me/history?${params}`)
    if (res.status === 410) {
      throw new HistoryExpiredError('History ID expired')
    }
    if (!res.ok) throw new Error(`Gmail listHistory failed: ${res.status} ${await res.text()}`)
    return res.json() as Promise<GmailHistoryResponse>
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const res = await fetch(
      `${this.baseUrl}/v1/users/me/messages/${messageId}?format=full`,
    )
    if (!res.ok) throw new Error(`Gmail getMessage failed: ${res.status} ${await res.text()}`)
    return res.json() as Promise<GmailMessage>
  }

  async modifyMessage(
    messageId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      },
    )
    if (!res.ok) throw new Error(`Gmail modifyMessage failed: ${res.status} ${await res.text()}`)
  }

  async createDraft(to: string, subject: string, body: string, threadId: string): Promise<string> {
    const raw = buildRawEmail(to, subject, body)
    const res = await fetch(`${this.baseUrl}/v1/users/me/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { raw, threadId },
      }),
    })
    if (!res.ok) throw new Error(`Gmail createDraft failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { id: string }
    return data.id
  }

  async watch(topicName: string): Promise<WatchResponse> {
    const res = await fetch(`${this.baseUrl}/v1/users/me/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX'],
      }),
    })
    if (!res.ok) throw new Error(`Gmail watch failed: ${res.status} ${await res.text()}`)
    return res.json() as Promise<WatchResponse>
  }

  async getOrCreateLabel(name: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/users/me/labels`)
    if (!res.ok) throw new Error(`Gmail listLabels failed: ${res.status}`)
    const data = (await res.json()) as { labels: { id: string; name: string }[] }
    const existing = data.labels.find((l) => l.name === name)
    if (existing) return existing.id

    const createRes = await fetch(`${this.baseUrl}/v1/users/me/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    })
    if (!createRes.ok) throw new Error(`Gmail createLabel failed: ${createRes.status}`)
    const created = (await createRes.json()) as { id: string }
    return created.id
  }
}

export class HistoryExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HistoryExpiredError'
  }
}

export function parseMessage(msg: GmailMessage): ParsedEmail {
  const getHeader = (name: string) =>
    msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

  const subject = getHeader('subject')
  const body = extractBody(msg.payload)

  if (!subject && !body) {
    log.warn(
      { messageId: msg.id, headers: msg.payload.headers.map((h) => h.name), mimeType: msg.payload.mimeType, parts: msg.payload.parts?.length ?? 0 },
      'Empty subject+body',
    )
  }

  return {
    messageId: msg.id,
    threadId: msg.threadId,
    from: getHeader('from'),
    to: getHeader('to'),
    subject,
    body,
    labels: msg.labelIds ?? [],
    date: getHeader('date') || new Date(parseInt(msg.internalDate)).toISOString(),
  }
}

function extractBody(payload: GmailPayload): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    return extractFromParts(payload.parts)
  }
  return ''
}

function extractFromParts(parts: GmailPart[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
    if (part.parts) {
      const nested = extractFromParts(part.parts)
      if (nested) return nested
    }
  }
  return ''
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function buildRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: Re: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')
  return Buffer.from(message).toString('base64url')
}
