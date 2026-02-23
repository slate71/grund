// Delivery service abstraction — provider-agnostic interface
// Implementations: Kroger (v1), extensible to others

export interface Product {
  productId: string
  upc: string
  name: string
  description: string
  brand: string
  category: string
  size: string
  price: Price | null
  images: ProductImage[]
  inStock: boolean
}

export interface Price {
  regular: number
  promo: number | null
}

export interface ProductImage {
  url: string
  size: 'small' | 'medium' | 'large' | 'xlarge'
}

export interface CartItem {
  productId: string
  upc: string
  name: string
  quantity: number
}

export interface Cart {
  items: CartItem[]
  estimatedTotal: number
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
  phone: string
  departments: string[]
}

export interface SearchOptions {
  locationId?: string
  limit?: number
}

export interface DeliveryService {
  readonly provider: string

  // Search the store catalog
  searchProducts(query: string, options?: SearchOptions): Promise<Product[]>

  // Get a specific product by ID
  getProduct(productId: string): Promise<Product | null>

  // Add item to cart (requires user auth)
  addToCart(upc: string, quantity: number): Promise<void>

  // Find nearby store locations
  searchLocations(zipCode: string, radiusMiles?: number): Promise<StoreLocation[]>
}

// Auth tokens for OAuth2 flows
export interface AuthTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: number // unix timestamp
  scope: string
}
