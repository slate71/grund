import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

export interface NewsletterConfig {
  valued: {
    domains: string[]
    senders: string[]
    patterns: string[]
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadNewsletterConfig(
  path?: string,
): NewsletterConfig {
  const configPath = path ?? resolve(__dirname, 'newsletters.yml')
  const raw = readFileSync(configPath, 'utf-8')
  return parseYaml(raw) as NewsletterConfig
}

export function matchNewsletter(
  from: string,
  subject: string,
  config: NewsletterConfig,
): 'newsletter_valued' | null {
  const fromLower = from.toLowerCase()

  for (const domain of config.valued.domains) {
    if (fromLower.includes(domain.toLowerCase())) {
      return 'newsletter_valued'
    }
  }

  for (const sender of config.valued.senders) {
    if (fromLower.includes(sender.toLowerCase())) {
      return 'newsletter_valued'
    }
  }

  for (const pattern of config.valued.patterns) {
    if (new RegExp(pattern, 'i').test(subject)) {
      return 'newsletter_valued'
    }
  }

  return null
}
