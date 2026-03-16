import type { BriefEmail, GeneratedBrief } from './types'
import { SECTION_CONFIG } from './types'

interface RendererOptions {
  anthropicBaseUrl: string
  anthropicApiKey: string
}

const BRIEF_SYSTEM_PROMPT = `You are generating a daily email brief — a scannable plain text summary of non-urgent emails.

You will receive a structured list of emails grouped by category. Generate a plain text summary that is:
- Scannable in 30 seconds
- For each section, write a 1-2 sentence summary of the highlights, then list individual emails compactly (sender + subject)
- If a section has many similar emails (e.g. 10 GitHub notifications), group them into a single line like "10 GitHub notifications (repo-x, repo-y)"
- Keep it concise and useful

Output only the plain text, no commentary or markup.`

export async function renderBrief(
  emails: BriefEmail[],
  periodStart: Date,
  periodEnd: Date,
  opts: RendererOptions,
): Promise<GeneratedBrief> {
  const isMorning = periodEnd.getHours() < 14
  const briefType = isMorning ? 'Morning' : 'Afternoon'
  const dateStr = periodEnd.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const subject = `${briefType} Brief: ${dateStr}, ${emails.length} ${emails.length === 1 ? 'email' : 'emails'}`

  const grouped = new Map<string, BriefEmail[]>()
  for (const email of emails) {
    const list = grouped.get(email.category) ?? []
    list.push(email)
    grouped.set(email.category, list)
  }

  const sections: string[] = []
  for (const [category, config] of Object.entries(SECTION_CONFIG)) {
    const categoryEmails = grouped.get(category)
    if (!categoryEmails?.length) continue

    const emailLines = categoryEmails.map(
      (e) => `  - ${e.fromAddress} | ${e.subject}`,
    )
    sections.push(
      `${config.icon} ${config.title} (${categoryEmails.length}):\n${emailLines.join('\n')}`,
    )
  }

  const userMessage = [
    `Generate the ${briefType} Brief for ${dateStr}.`,
    `Period: ${periodStart.toLocaleTimeString()} – ${periodEnd.toLocaleTimeString()}`,
    `Total emails: ${emails.length}`,
    '',
    ...sections,
  ].join('\n')

  const res = await fetch(`${opts.anthropicBaseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.BRIEF_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[]
  }

  const body = data.content.find((c) => c.type === 'text')?.text ?? ''

  return {
    subject,
    body,
    emailCount: emails.length,
    periodStart,
    periodEnd,
  }
}
