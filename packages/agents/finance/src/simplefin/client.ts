import type {
  NormalizedAccount,
  NormalizedTransaction,
  SimpleFinResponse,
  SyncResult,
} from './types'

// Fetches accounts and transactions from SimpleFIN *through the credential
// proxy*, so the SimpleFIN access token never lives in this container. The proxy
// route (`/simplefin/accounts`) is added in milestone 2; until then this client
// surfaces a clear error rather than pretending to have data.
export class SimpleFinClient {
  private baseUrl: string

  constructor(proxyUrl: string) {
    this.baseUrl = `${proxyUrl}/simplefin`
  }

  // Pull accounts (with embedded transactions) posted on/after `since`.
  async sync(since: Date | null): Promise<SyncResult> {
    const url = new URL(`${this.baseUrl}/accounts`)
    if (since) {
      // SimpleFIN expects start-date as epoch seconds.
      url.searchParams.set('start-date', String(Math.floor(since.getTime() / 1000)))
    }

    const res = await fetch(url.toString())
    if (res.status === 404) {
      throw new ProxyRouteNotConfiguredError(
        'Credential-proxy /simplefin route not configured yet (milestone 2).',
      )
    }
    if (!res.ok) {
      throw new Error(`SimpleFIN sync failed: ${res.status} ${await res.text()}`)
    }

    const data = (await res.json()) as SimpleFinResponse
    return normalize(data)
  }
}

export class ProxyRouteNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProxyRouteNotConfiguredError'
  }
}

export function normalize(data: SimpleFinResponse): SyncResult {
  const accounts: NormalizedAccount[] = []
  const transactions: NormalizedTransaction[] = []

  for (const acct of data.accounts ?? []) {
    accounts.push({
      externalId: acct.id,
      org: acct.org?.name ?? acct.org?.domain ?? null,
      name: acct.name,
      type: null, // SimpleFIN does not classify account type
      currency: acct.currency,
      balance: acct.balance ?? null,
      availableBalance: acct['available-balance'] ?? null,
      balanceDate: epochToDate(acct['balance-date']),
    })

    for (const txn of acct.transactions ?? []) {
      transactions.push({
        externalId: txn.id,
        accountId: acct.id,
        postedAt: epochToDate(txn.posted) ?? new Date(),
        amount: txn.amount,
        payee: txn.payee ?? null,
        description: txn.description ?? null,
        memo: txn.memo ?? null,
        pending: txn.pending ?? false,
      })
    }
  }

  return { accounts, transactions }
}

function epochToDate(seconds: number | undefined): Date | null {
  if (seconds == null) return null
  return new Date(seconds * 1000)
}
