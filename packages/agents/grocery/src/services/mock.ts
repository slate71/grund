import type {
  DeliveryService,
  Product,
  StoreLocation,
  SearchOptions,
  ShoppableItem,
  ShoppableList,
} from './types.js'

// Mock delivery service for testing and development without API credentials

const MOCK_PRODUCTS: Product[] = [
  {
    productId: 'mock-001',
    name: 'Organic Whole Milk',
    description: 'Organic Whole Milk',
    brand: 'Organic Valley',
    category: 'Dairy',
    size: '1 gal',
    price: { regular: 6.49, promo: null },
    imageUrl: null,
    inStock: true,
  },
  {
    productId: 'mock-002',
    name: 'Large Brown Eggs',
    description: 'Large Brown Eggs, Cage Free',
    brand: 'Vital Farms',
    category: 'Dairy',
    size: '12 ct',
    price: { regular: 5.99, promo: 4.99 },
    imageUrl: null,
    inStock: true,
  },
  {
    productId: 'mock-003',
    name: 'Banana',
    description: 'Fresh Banana',
    brand: '',
    category: 'Produce',
    size: '1 each',
    price: { regular: 0.25, promo: null },
    imageUrl: null,
    inStock: true,
  },
  {
    productId: 'mock-004',
    name: 'Whole Wheat Bread',
    description: 'Whole Wheat Sliced Bread',
    brand: 'Dave\'s Killer Bread',
    category: 'Bakery',
    size: '27 oz',
    price: { regular: 5.49, promo: null },
    imageUrl: null,
    inStock: true,
  },
  {
    productId: 'mock-005',
    name: 'Kerrygold Pure Irish Butter',
    description: 'Kerrygold Pure Irish Butter, Salted',
    brand: 'Kerrygold',
    category: 'Dairy',
    size: '8 oz',
    price: { regular: 4.99, promo: 3.99 },
    imageUrl: null,
    inStock: true,
  },
  {
    productId: 'mock-006',
    name: 'Green Onions',
    description: 'Green Onions Bunch',
    brand: '',
    category: 'Produce',
    size: '1 bunch',
    price: { regular: 0.99, promo: null },
    imageUrl: null,
    inStock: false,
  },
]

const MOCK_LOCATION: StoreLocation = {
  locationId: 'safeway-broadway',
  name: 'Safeway',
  chain: 'Safeway',
  address: {
    street: '224 Broadway',
    city: 'Oakland',
    state: 'CA',
    zipCode: '94607',
  },
}

export function createMockService(): DeliveryService {
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

    async createShoppableList(items: ShoppableItem[]): Promise<ShoppableList> {
      return {
        listId: `mock-list-${Date.now()}`,
        checkoutUrl: 'https://www.instacart.com/store/mock-checkout',
        matchedItems: items.map((item) => {
          const match = MOCK_PRODUCTS.find(
            (p) => p.name.toLowerCase().includes(item.name.toLowerCase()),
          )
          return {
            name: item.name,
            matched: !!match,
            productName: match?.name,
          }
        }),
      }
    },

    async searchLocations(_zipCode: string, _radiusMiles?: number): Promise<StoreLocation[]> {
      return [MOCK_LOCATION]
    },
  }
}
