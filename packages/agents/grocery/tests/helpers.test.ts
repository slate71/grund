import { describe, it, expect, beforeEach } from 'vitest'
import type { InventoryData, HistoryData } from '../src/inventory/types.js'
import {
  getLowStockItems,
  getExpiringItems,
  getExpiredItems,
  getItemsByCategory,
  findItem,
  createItemId,
  summarizeInventory,
  addHistoryEntry,
} from '../src/inventory/helpers.js'

function makeInventory(overrides: Partial<InventoryData['items'][0]>[] = []): InventoryData {
  const defaults = [
    {
      id: 'whole-milk',
      name: 'Whole milk',
      category: 'dairy' as const,
      quantity: 1,
      unit: 'gallon',
      expiresAt: '2026-03-10',
      reorderAt: 1,
      preferredBrand: null,
      notes: null,
      lastUpdated: '2026-02-23T00:00:00.000Z',
    },
    {
      id: 'eggs',
      name: 'Eggs',
      category: 'dairy' as const,
      quantity: 3,
      unit: 'count',
      expiresAt: '2026-02-24',
      reorderAt: 4,
      preferredBrand: null,
      notes: null,
      lastUpdated: '2026-02-23T00:00:00.000Z',
    },
    {
      id: 'rice',
      name: 'Jasmine rice',
      category: 'pantry' as const,
      quantity: 5,
      unit: 'lb',
      expiresAt: null,
      reorderAt: 2,
      preferredBrand: null,
      notes: null,
      lastUpdated: '2026-02-23T00:00:00.000Z',
    },
    {
      id: 'chicken-breast',
      name: 'Chicken breast',
      category: 'meat' as const,
      quantity: 0,
      unit: 'lb',
      expiresAt: '2026-02-20',
      reorderAt: 1,
      preferredBrand: null,
      notes: null,
      lastUpdated: '2026-02-23T00:00:00.000Z',
    },
  ]

  const items = defaults.map((d, i) => ({ ...d, ...overrides[i] }))
  return {
    items,
    metadata: { lastUpdated: '2026-02-23T00:00:00.000Z', totalItems: items.length, categories: {} },
  }
}

describe('getLowStockItems', () => {
  it('returns items at or below reorder threshold', () => {
    const inv = makeInventory()
    const low = getLowStockItems(inv)
    // milk: 1 qty, 1 reorder (at threshold) -> low
    // eggs: 3 qty, 4 reorder -> low
    // rice: 5 qty, 2 reorder -> fine
    // chicken: 0 qty, 1 reorder -> low
    expect(low.map((i) => i.id)).toEqual(['whole-milk', 'eggs', 'chicken-breast'])
  })

  it('returns empty when all items are above threshold', () => {
    const inv = makeInventory([{ quantity: 10 }, { quantity: 10 }, { quantity: 10 }, { quantity: 10 }])
    expect(getLowStockItems(inv)).toEqual([])
  })
})

describe('getExpiringItems', () => {
  it('returns items expiring within N days that have stock', () => {
    // Use a fixed "today" by constructing inventory with known dates
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)

    const inv: InventoryData = {
      items: [
        {
          id: 'a',
          name: 'A',
          category: 'dairy',
          quantity: 1,
          unit: 'ct',
          expiresAt: tomorrow.toISOString().split('T')[0],
          reorderAt: 1,
          preferredBrand: null,
          notes: null,
          lastUpdated: '',
        },
        {
          id: 'b',
          name: 'B',
          category: 'dairy',
          quantity: 1,
          unit: 'ct',
          expiresAt: nextWeek.toISOString().split('T')[0],
          reorderAt: 1,
          preferredBrand: null,
          notes: null,
          lastUpdated: '',
        },
        {
          id: 'c',
          name: 'C',
          category: 'pantry',
          quantity: 1,
          unit: 'ct',
          expiresAt: null,
          reorderAt: 1,
          preferredBrand: null,
          notes: null,
          lastUpdated: '',
        },
      ],
      metadata: { lastUpdated: '', totalItems: 3, categories: {} },
    }

    const expiring = getExpiringItems(inv, 3)
    expect(expiring.map((i) => i.id)).toEqual(['a'])
  })

  it('excludes items with zero quantity', () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const inv: InventoryData = {
      items: [
        {
          id: 'a',
          name: 'A',
          category: 'dairy',
          quantity: 0,
          unit: 'ct',
          expiresAt: tomorrow.toISOString().split('T')[0],
          reorderAt: 1,
          preferredBrand: null,
          notes: null,
          lastUpdated: '',
        },
      ],
      metadata: { lastUpdated: '', totalItems: 1, categories: {} },
    }

    expect(getExpiringItems(inv, 3)).toEqual([])
  })
})

describe('getExpiredItems', () => {
  it('returns items past their expiration date with stock remaining', () => {
    const inv = makeInventory()
    // chicken-breast has expiresAt 2026-02-20 and quantity 0 -> excluded (no stock)
    // We need an item with past date AND stock
    inv.items[3].quantity = 2 // give chicken some stock
    const expired = getExpiredItems(inv)
    expect(expired.map((i) => i.id)).toContain('chicken-breast')
  })
})

describe('getItemsByCategory', () => {
  it('filters by category', () => {
    const inv = makeInventory()
    const dairy = getItemsByCategory(inv, 'dairy')
    expect(dairy.map((i) => i.id)).toEqual(['whole-milk', 'eggs'])
  })
})

describe('findItem', () => {
  it('finds by id', () => {
    const inv = makeInventory()
    expect(findItem(inv, 'whole-milk')?.name).toBe('Whole milk')
  })

  it('finds by name (case insensitive)', () => {
    const inv = makeInventory()
    expect(findItem(inv, 'jasmine rice')?.id).toBe('rice')
  })

  it('returns undefined for unknown item', () => {
    const inv = makeInventory()
    expect(findItem(inv, 'pizza')).toBeUndefined()
  })
})

describe('createItemId', () => {
  it('slugifies names', () => {
    expect(createItemId('Whole Milk')).toBe('whole-milk')
    expect(createItemId("Amy's Organic Soup")).toBe('amy-s-organic-soup')
    expect(createItemId('  Extra   Spaces  ')).toBe('extra-spaces')
  })
})

describe('summarizeInventory', () => {
  it('produces correct counts', () => {
    const inv = makeInventory()
    const summary = summarizeInventory(inv)
    expect(summary.total).toBe(4)
    expect(summary.lowStock).toBe(3)
    expect(summary.byCategory).toEqual({ dairy: 2, pantry: 1, meat: 1 })
  })
})

describe('addHistoryEntry', () => {
  it('adds a timestamped entry', () => {
    const history: HistoryData = { entries: [] }
    addHistoryEntry(history, {
      action: 'add',
      itemId: 'test',
      itemName: 'Test',
      quantityChange: 5,
      quantityAfter: 5,
    })
    expect(history.entries).toHaveLength(1)
    expect(history.entries[0].action).toBe('add')
    expect(history.entries[0].timestamp).toBeTruthy()
  })
})
