import { createHash } from 'node:crypto'
import type { NormalizedAccount, NormalizedTransaction } from '../simplefin/types'

// Apple Card can't be linked through SimpleFIN (device-based 2FA breaks
// aggregators), so it's ingested from the monthly statement CSV export instead.
// Imported rows flow through the same recordTransaction -> categorize pipeline as
// aggregator data; this module only turns the CSV into NormalizedTransaction[].

export const APPLE_CARD_ACCOUNT_ID = 'apple-card'

export const APPLE_CARD_ACCOUNT: NormalizedAccount = {
  externalId: APPLE_CARD_ACCOUNT_ID,
  org: 'Goldman Sachs',
  name: 'Apple Card',
  type: 'credit',
  currency: 'USD',
  balance: null,
  availableBalance: null,
  balanceDate: null,
}

// Header names are matched case-insensitively so minor export variations
// ("Amount (USD)" vs "Amount", "Transaction Date" vs "Date") both work.
const COLUMNS = {
  transactionDate: ['transaction date', 'date'],
  clearingDate: ['clearing date'],
  description: ['description'],
  merchant: ['merchant'],
  category: ['category'],
  type: ['type'],
  amount: ['amount (usd)', 'amount'],
} as const

export function parseAppleCardCsv(content: string): NormalizedTransaction[] {
  const rows = parseCsv(content)
  if (rows.length === 0) return []

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = resolveColumns(header)

  const seen = new Map<string, number>()
  const transactions: NormalizedTransaction[] = []

  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === '')) continue // skip blank lines

    const get = (key: keyof typeof col) => (col[key] === -1 ? '' : (row[col[key]] ?? '').trim())

    const rawAmount = get('amount')
    if (rawAmount === '') continue // not a transaction row (e.g. trailing totals)

    const transactionDate = get('transactionDate')
    const clearingDate = get('clearingDate')
    const merchant = get('merchant') || null
    const description = get('description') || null
    const category = get('category') || null
    const type = get('type') || null

    // Apple Card lists purchases as positive and payments/credits as negative.
    // Our schema is signed with negative = outflow, so flip the sign.
    const amount = (-parseAmount(rawAmount)).toFixed(2)

    const posted = parseDate(clearingDate) ?? parseDate(transactionDate)
    if (!posted) continue // unparseable date -> skip rather than store garbage

    const key = `${transactionDate}|${clearingDate}|${amount}|${merchant ?? ''}|${description ?? ''}`
    const occurrence = (seen.get(key) ?? 0) + 1
    seen.set(key, occurrence)

    const hash = createHash('sha1').update(key).digest('hex').slice(0, 16)
    const externalId = `${APPLE_CARD_ACCOUNT_ID}:${hash}${occurrence > 1 ? `-${occurrence}` : ''}`

    transactions.push({
      externalId,
      accountId: APPLE_CARD_ACCOUNT_ID,
      postedAt: posted,
      amount,
      payee: merchant ?? description,
      description,
      memo: category ?? type, // Apple's own category is a useful hint for the categorizer
      pending: clearingDate === '',
    })
  }

  return transactions
}

function resolveColumns(header: string[]): Record<keyof typeof COLUMNS, number> {
  const find = (names: readonly string[]) => header.findIndex((h) => names.includes(h))
  const col = {
    transactionDate: find(COLUMNS.transactionDate),
    clearingDate: find(COLUMNS.clearingDate),
    description: find(COLUMNS.description),
    merchant: find(COLUMNS.merchant),
    category: find(COLUMNS.category),
    type: find(COLUMNS.type),
    amount: find(COLUMNS.amount),
  }

  if (col.amount === -1 || col.transactionDate === -1 || (col.merchant === -1 && col.description === -1)) {
    throw new Error(
      `Unrecognized Apple Card CSV header. Need an amount, a date, and a merchant/description column. Got: ${header.join(', ')}`,
    )
  }
  return col
}

// "$1,234.56" -> 1234.56 ; "($50.00)" or "-$50.00" -> -50
function parseAmount(raw: string): number {
  const negative = /^\(.*\)$/.test(raw.trim()) || raw.includes('-')
  const n = Number(raw.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) throw new Error(`Unparseable amount: "${raw}"`)
  return negative ? -n : n
}

// "MM/DD/YYYY" -> Date (UTC midnight). Returns null for empty/invalid input.
function parseDate(raw: string): Date | null {
  if (!raw) return null
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
}

// Minimal RFC4180 CSV parser: handles quoted fields, embedded commas/newlines,
// and "" escaped quotes. Avoids a dependency for one well-defined format.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
