import type { DeliveryService, Product, StoreLocation, SearchOptions } from './types.js'

// Mock delivery service for testing and development without API credentials

const MOCK_PRODUCTS: Product[] = [
  {
    productId: 'mock-001',
    upc: '0001111041700',
    name: 'Kroger Vitamin D Whole Milk',
    description: 'Kroger Vitamin D Whole Milk',
    brand: 'Kroger',
    category: 'Dairy',
    size: '1 gal',
    price: { regular: 3.99, promo: null },
    images: [],
    inStock: true,
  },
  {
    productId: 'mock-002',
    upc: '0001111060903',
    name: 'Kroger Grade A Large Eggs',
    description: 'Kroger Grade A Large Eggs',
    brand: 'Kroger',
    category: 'Dairy',
    size: '12 ct',
    price: { regular: 4.29, promo: 3.49 },
    images: [],
    inStock: true,
  },
  {
    productId: 'mock-003',
    upc: '0000000004011',
    name: 'Banana',
    description: 'Fresh Banana',
    brand: '',
    category: 'Produce',
    size: '1 each',
    price: { regular: 0.25, promo: null },
    images: [],
    inStock: true,
  },
  {
    productId: 'mock-004',
    upc: '0001111087373',
    name: 'Kroger Wheat Bread',
    description: 'Kroger Soft Wheat Bread',
    brand: 'Kroger',
    category: 'Bakery',
    size: '20 oz',
    price: { regular: 2.49, promo: null },
    images: [],
    inStock: true,
  },
  {
    productId: 'mock-005',
    upc: '0001111050905',
    name: 'Kroger Butter',
    description: 'Kroger Salted Butter Sticks',
    brand: 'Kroger',
    category: 'Dairy',
    size: '16 oz',
    price: { regular: 4.99, promo: 3.99 },
    images: [],
    inStock: true,
  },
  {
    productId: 'mock-006',
    upc: '0000000094011',
    name: 'Green Onions',
    description: 'Green Onions Bunch',
    brand: '',
    category: 'Produce',
    size: '1 bunch',
    price: { regular: 0.99, promo: null },
    images: [],
    inStock: false,
  },
]

const MOCK_LOCATION: StoreLocation = {
  locationId: '70300015',
  name: 'Kroger - Downtown',
  chain: 'Kroger',
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
  },
  phone: '(415) 555-0100',
  departments: ['Bakery', 'Deli', 'Produce', 'Dairy', 'Meat', 'Seafood', 'Frozen'],
}

export function createMockService(): DeliveryService {
  const cart: { upc: string; quantity: number }[] = []

  return {
    provider: 'mock',

    async searchProducts(query: string, _options?: SearchOptions): Promise<Product[]> {
      const term = query.toLowerCase()
      return MOCK_PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term) ||
          p.brand.toLowerCase().includes(term),
      )
    },

    async getProduct(productId: string): Promise<Product | null> {
      return MOCK_PRODUCTS.find((p) => p.productId === productId) ?? null
    },

    async addToCart(upc: string, quantity: number): Promise<void> {
      cart.push({ upc, quantity })
    },

    async searchLocations(_zipCode: string, _radiusMiles?: number): Promise<StoreLocation[]> {
      return [MOCK_LOCATION]
    },
  }
}
