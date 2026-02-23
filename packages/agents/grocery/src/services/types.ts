// Delivery service abstraction — provider-agnostic interface
// Implementations: Instacart IDP, Mock (dev/test)

export interface Product {
  productId: string
  name: string
  description: string
  brand: string
  category: string
  size: string
  price: Price | null
  imageUrl: string | null
  inStock: boolean
}

export interface Price {
  regular: number
  promo: number | null
}

export interface ShoppableItem {
  name: string
  quantity: number
  unit?: string
  productId?: string // Provider product ID from a previous search
}

export interface ShoppableList {
  listId: string
  checkoutUrl: string
  matchedItems: { name: string; matched: boolean; productName?: string }[]
}

export interface StoreLocation {
  locationId: string
  name: string
  chain: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
  }
}

export interface SearchOptions {
  postalCode?: string
  limit?: number
}

export interface DeliveryService {
  readonly provider: string

  // Search the store catalog
  searchProducts(query: string, options?: SearchOptions): Promise<Product[]>

  // Get a specific product by ID
  getProduct(productId: string): Promise<Product | null>

  // Build a shoppable list and return a checkout URL
  // For Instacart: generates a link to an Instacart landing page where the user completes checkout
  createShoppableList(items: ShoppableItem[]): Promise<ShoppableList>

  // Find nearby retailers / store locations
  searchLocations(zipCode: string, radiusMiles?: number): Promise<StoreLocation[]>
}
