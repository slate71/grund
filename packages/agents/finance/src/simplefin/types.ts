// Normalized shapes the rest of the agent consumes, independent of which
// aggregator produced them. SimpleFIN is the first (and current) source; the
// proxy hides the wire format so swapping to Plaid later doesn't touch this.

export interface NormalizedAccount {
  externalId: string
  org: string | null
  name: string
  type: string | null
  currency: string
  balance: string | null // decimal string
  availableBalance: string | null
  balanceDate: Date | null
}

export interface NormalizedTransaction {
  externalId: string
  accountId: string // matches NormalizedAccount.externalId
  postedAt: Date
  amount: string // signed decimal string, negative = outflow
  payee: string | null
  description: string | null
  memo: string | null
  pending: boolean
}

export interface SyncResult {
  accounts: NormalizedAccount[]
  transactions: NormalizedTransaction[]
}

// Raw SimpleFIN /accounts response shapes (subset we use).
// https://www.simplefin.org/protocol.html
export interface SimpleFinResponse {
  errors?: string[]
  accounts: SimpleFinAccount[]
}

export interface SimpleFinAccount {
  id: string
  org?: { name?: string; domain?: string }
  name: string
  currency: string
  balance: string
  'available-balance'?: string
  'balance-date'?: number // epoch seconds
  transactions?: SimpleFinTransaction[]
}

export interface SimpleFinTransaction {
  id: string
  posted: number // epoch seconds
  amount: string
  description?: string
  payee?: string
  memo?: string
  pending?: boolean
}
