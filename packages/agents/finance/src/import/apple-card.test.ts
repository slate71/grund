import { describe, it, expect } from 'vitest'
import { parseAppleCardCsv, APPLE_CARD_ACCOUNT_ID } from './apple-card'

const HEADER = 'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)'

describe('parseAppleCardCsv', () => {
  it('flips sign so purchases are outflows and payments are inflows', () => {
    const csv = [
      HEADER,
      '06/01/2026,06/02/2026,WHOLE FOODS,Whole Foods,Grocery,Purchase,84.12',
      '06/15/2026,06/16/2026,ACH PAYMENT,Apple Card Payment,Payment,Payment,-2000.00',
    ].join('\n')

    const [purchase, payment] = parseAppleCardCsv(csv)
    expect(purchase.amount).toBe('-84.12') // outflow
    expect(payment.amount).toBe('2000.00') // inflow
    expect(purchase.accountId).toBe(APPLE_CARD_ACCOUNT_ID)
    expect(purchase.payee).toBe('Whole Foods')
    expect(purchase.memo).toBe('Grocery') // Apple's category preserved as a hint
  })

  it('handles quoted fields with embedded commas', () => {
    const csv = [HEADER, '06/03/2026,06/04/2026,"BIG STORE, INC.","Big Store, Inc.",Shopping,Purchase,"1,234.56"'].join('\n')
    const [txn] = parseAppleCardCsv(csv)
    expect(txn.payee).toBe('Big Store, Inc.')
    expect(txn.amount).toBe('-1234.56')
  })

  it('produces deterministic IDs (idempotent re-import) and disambiguates true duplicates', () => {
    const csv = [
      HEADER,
      '06/01/2026,06/02/2026,COFFEE,Blue Bottle,Restaurants,Purchase,5.00',
      '06/01/2026,06/02/2026,COFFEE,Blue Bottle,Restaurants,Purchase,5.00',
    ].join('\n')

    const first = parseAppleCardCsv(csv)
    const second = parseAppleCardCsv(csv)
    expect(first.map((t) => t.externalId)).toEqual(second.map((t) => t.externalId)) // stable
    expect(first[0].externalId).not.toBe(first[1].externalId) // two same-day coffees kept distinct
  })

  it('marks rows without a clearing date as pending', () => {
    const csv = [HEADER, '06/20/2026,,PENDING CHARGE,Some Merchant,Other,Purchase,12.00'].join('\n')
    const [txn] = parseAppleCardCsv(csv)
    expect(txn.pending).toBe(true)
    expect(txn.postedAt.toISOString().slice(0, 10)).toBe('2026-06-20') // falls back to transaction date
  })

  it('tolerates the simpler Date/Amount header variant', () => {
    const csv = ['Date,Type,Description,Amount', '06/01/2026,Purchase,Some Shop,42.00'].join('\n')
    const [txn] = parseAppleCardCsv(csv)
    expect(txn.amount).toBe('-42.00')
    expect(txn.description).toBe('Some Shop')
  })

  it('throws a clear error on an unrecognized header', () => {
    expect(() => parseAppleCardCsv('Foo,Bar,Baz\n1,2,3')).toThrow(/Unrecognized Apple Card CSV header/)
  })
})
