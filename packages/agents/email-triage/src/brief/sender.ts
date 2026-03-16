import type { GmailClient } from '../gmail/client'
import type { GeneratedBrief } from './types'

export async function sendBrief(
  gmail: GmailClient,
  recipientEmail: string,
  brief: GeneratedBrief,
): Promise<string> {
  const raw = buildHtmlEmail(recipientEmail, brief.subject, brief.htmlBody)
  return gmail.sendMessage(raw)
}

function buildHtmlEmail(to: string, subject: string, htmlBody: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody,
  ].join('\r\n')
  return Buffer.from(message).toString('base64url')
}
