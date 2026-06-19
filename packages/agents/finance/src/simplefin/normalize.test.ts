import { describe, it, expect } from 'vitest'
import { normalize } from './client'
import type { SimpleFinResponse } from './types'

describe('normalize', () => {
  const response: SimpleFinResponse = {
    accounts: [
      {
        id: 'acct-1',
        org: { name: 'Test Bank' },
        name: 'Checking',
        currency: 'USD',
        balance: '1234.56',
        'available-balance': '1200.00',
        'balance-date': 1_700_000_000,
        transactions: [
          {
            id: 'txn-1',
            posted: 1_700_000_100,
            amount: '-33.04',
            payee: 'Coffee Shop',
            description: 'CARD PURCHASE',
            pending: false,
          },
          {
            id: 'txn-2',
            posted: 1_700_000_200,
            amount: '2500.00',
            description: 'PAYROLL',
          },
        ],
      },
    ],
  }

  it('maps accounts with balances and org name', () => {
    const { accounts } = normalize(response)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({
      externalId: 'acct-1',
      org: 'Test Bank',
      name: 'Checking',
      currency: 'USD',
      balance: '1234.56',
      availableBalance: '1200.00',
    })
    expect(accounts[0].balanceDate).toEqual(new Date(1_700_000_000 * 1000))
  })

  it('flattens transactions and links them to their account', () => {
    const { transactions } = normalize(response)
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toMatchObject({
      externalId: 'txn-1',
      accountId: 'acct-1',
      amount: '-33.04',
      payee: 'Coffee Shop',
      pending: false,
    })
    expect(transactions[0].postedAt).toEqual(new Date(1_700_000_100 * 1000))
  })

  it('defaults optional fields when absent', () => {
    const { transactions } = normalize(response)
    // txn-2 has no payee/memo/pending
    expect(transactions[1]).toMatchObject({
      externalId: 'txn-2',
      payee: null,
      memo: null,
      pending: false,
    })
  })

  it('handles an empty response', () => {
    expect(normalize({ accounts: [] })).toEqual({ accounts: [], transactions: [] })
  })
})
