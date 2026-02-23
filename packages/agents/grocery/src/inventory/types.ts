export type Category =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'frozen'
  | 'pantry'
  | 'snacks'
  | 'beverages'
  | 'condiments'
  | 'household'
  | 'other'

export interface GroceryItem {
  id: string
  name: string
  category: Category
  quantity: number
  unit: string // "gallon", "count", "oz", "lb", "bag", etc.
  expiresAt: string | null // ISO date string
  reorderAt: number // reorder when quantity drops to this level
  preferredBrand: string | null
  notes: string | null
  lastUpdated: string // ISO date string
}

export interface InventoryData {
  items: GroceryItem[]
  metadata: {
    lastUpdated: string
    totalItems: number
    categories: Record<string, number>
  }
}

export interface ProductMapping {
  itemId: string // references GroceryItem.id
  itemName: string
  kroger: {
    upc: string
    productId: string
    name: string
    size: string
  } | null
  fallbackSearchTerm: string
}

export interface ProductMapData {
  mappings: ProductMapping[]
}

export interface OrderRecord {
  id: string
  createdAt: string
  items: OrderItem[]
  estimatedTotal: number
  store: string | null
  status: 'cart-built' | 'submitted' | 'delivered'
  notes: string | null
}

export interface OrderItem {
  itemId: string
  name: string
  quantity: number
  unit: string
  upc: string | null
  price: number | null
}

export interface OrderHistory {
  orders: OrderRecord[]
}

export interface Preferences {
  weeklyBudget: number
  preferredStore: {
    locationId: string
    name: string
    chain: string
  } | null
  dietaryRestrictions: string[]
  preferredBrands: Record<string, string> // category → brand
  deliveryDay: string | null // "monday", "wednesday", etc.
  maxOrdersPerWeek: number
}

export interface HistoryEntry {
  timestamp: string
  action: 'add' | 'remove' | 'restock' | 'expire'
  itemId: string
  itemName: string
  quantityChange: number
  quantityAfter: number
}

export interface HistoryData {
  entries: HistoryEntry[]
}
