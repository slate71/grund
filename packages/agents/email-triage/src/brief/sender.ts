import type { GmailClient } from '../gmail/client'
import type { GeneratedBrief } from './types'

export async function sendBrief(
  gmail: GmailClient,
  recipientEmail: string,
  brief: GeneratedBrief,
): Promise<string> {
  const raw = buildEmail(recipientEmail, brief.subject, brief.body)
  return gmail.sendMessage(raw)
}

function buildEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n')
  return Buffer.from(message).toString('base64url')
}
