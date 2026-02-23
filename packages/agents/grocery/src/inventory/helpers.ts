import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type {
  GroceryItem,
  InventoryData,
  ProductMapData,
  ProductMapping,
  OrderHistory,
  OrderRecord,
  Preferences,
  HistoryData,
  HistoryEntry,
  Category,
} from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '..', '..', 'data')

// --- File I/O ---

export function loadInventory(): InventoryData {
  const data = readFileSync(join(DATA_DIR, 'inventory.json'), 'utf-8')
  return JSON.parse(data) as InventoryData
}

export function saveInventory(data: InventoryData): void {
  data.metadata.lastUpdated = new Date().toISOString()
  data.metadata.totalItems = data.items.length
  data.metadata.categories = countByCategory(data.items)
  writeFileSync(join(DATA_DIR, 'inventory.json'), JSON.stringify(data, null, 2))
}

export function loadProductMap(): ProductMapData {
  const data = readFileSync(join(DATA_DIR, 'product-map.json'), 'utf-8')
  return JSON.parse(data) as ProductMapData
}

export function saveProductMap(data: ProductMapData): void {
  writeFileSync(join(DATA_DIR, 'product-map.json'), JSON.stringify(data, null, 2))
}

export function loadOrders(): OrderHistory {
  const data = readFileSync(join(DATA_DIR, 'orders.json'), 'utf-8')
  return JSON.parse(data) as OrderHistory
}

export function saveOrders(data: OrderHistory): void {
  writeFileSync(join(DATA_DIR, 'orders.json'), JSON.stringify(data, null, 2))
}

export function loadPreferences(): Preferences {
  const data = readFileSync(join(DATA_DIR, 'preferences.json'), 'utf-8')
  return JSON.parse(data) as Preferences
}

export function loadHistory(): HistoryData {
  const data = readFileSync(join(DATA_DIR, 'history.json'), 'utf-8')
  return JSON.parse(data) as HistoryData
}

export function saveHistory(data: HistoryData): void {
  writeFileSync(join(DATA_DIR, 'history.json'), JSON.stringify(data, null, 2))
}

// --- Query Helpers ---

export function getLowStockItems(inventory: InventoryData): GroceryItem[] {
  return inventory.items.filter((item) => item.quantity <= item.reorderAt)
}

export function getExpiringItems(inventory: InventoryData, daysAhead: number = 3): GroceryItem[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  return inventory.items.filter(
    (item) => item.expiresAt !== null && item.expiresAt <= cutoffStr && item.quantity > 0,
  )
}

export function getExpiredItems(inventory: InventoryData): GroceryItem[] {
  const today = new Date().toISOString().split('T')[0]
  return inventory.items.filter(
    (item) => item.expiresAt !== null && item.expiresAt < today && item.quantity > 0,
  )
}

export function getItemsByCategory(inventory: InventoryData, category: Category): GroceryItem[] {
  return inventory.items.filter((item) => item.category === category)
}

export function findItem(inventory: InventoryData, idOrName: string): GroceryItem | undefined {
  return inventory.items.find(
    (item) => item.id === idOrName || item.name.toLowerCase() === idOrName.toLowerCase(),
  )
}

export function getProductMapping(
  productMap: ProductMapData,
  itemId: string,
): ProductMapping | undefined {
  return productMap.mappings.find((m) => m.itemId === itemId)
}

// --- Mutation Helpers ---

export function addHistoryEntry(
  history: HistoryData,
  entry: Omit<HistoryEntry, 'timestamp'>,
): void {
  history.entries.push({
    ...entry,
    timestamp: new Date().toISOString(),
  })
}

export function createItemId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// --- Reporting ---

function countByCategory(items: GroceryItem[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1
  }
  return counts
}

export function summarizeInventory(inventory: InventoryData): {
  total: number
  lowStock: number
  expiringSoon: number
  expired: number
  byCategory: Record<string, number>
} {
  return {
    total: inventory.items.length,
    lowStock: getLowStockItems(inventory).length,
    expiringSoon: getExpiringItems(inventory, 3).length,
    expired: getExpiredItems(inventory).length,
    byCategory: countByCategory(inventory.items),
  }
}
