// Spending taxonomy. Kept deliberately small and stable — a flat set of buckets
// that map cleanly to "where did my money go" questions over chat. Income and
// transfer are non-spending categories so totals can exclude them.
export type SpendingCategory =
  | 'income'
  | 'transfer'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'housing'
  | 'utilities'
  | 'health'
  | 'entertainment'
  | 'shopping'
  | 'travel'
  | 'subscriptions'
  | 'fees'
  | 'other'

export const SPENDING_CATEGORIES: SpendingCategory[] = [
  'income',
  'transfer',
  'groceries',
  'dining',
  'transport',
  'housing',
  'utilities',
  'health',
  'entertainment',
  'shopping',
  'travel',
  'subscriptions',
  'fees',
  'other',
]

// Categories that do not represent discretionary/consumption spending. Used to
// exclude them from spending rollups.
export const NON_SPENDING_CATEGORIES: SpendingCategory[] = ['income', 'transfer']

export interface CategoryDecision {
  category: SpendingCategory
  confidence: number
  reason: string
}

// A transaction as seen by the categorizer — the minimal fields it reasons over.
export interface CategorizableTransaction {
  externalId: string
  payee: string | null
  description: string | null
  memo: string | null
  amount: string // signed decimal string, negative = outflow
}
