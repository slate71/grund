import type {
  DeliveryService,
  Product,
  StoreLocation,
  SearchOptions,
  ShoppableItem,
  ShoppableList,
} from './types.js'

const BASE_URL = 'https://connect.instacart.com/idp/v1'

interface InstacartConfig {
  apiKey: string
  postalCode: string
}

// Raw Instacart IDP API response shapes

interface InstacartProductSearchResponse {
  products: InstacartProduct[]
}

interface InstacartProduct {
  id: string
  name: string
  brand: string | null
  category: string | null
  size: string | null
  image_url: string | null
  price: number | null
  sale_price: number | null
  in_stock: boolean
}

interface InstacartShoppableListResponse {
  list_id: string
  shoppable_url: string
  matched_items: {
    name: string
    matched: boolean
    product_name: string | null
  }[]
}

interface InstacartRetailerResponse {
  retailers: InstacartRetailer[]
}

interface InstacartRetailer {
  id: string
  name: string
  address: {
    street: string
    city: string
    state: string
    postal_code: string
  }
}

function getConfig(): InstacartConfig {
  const apiKey = process.env.INSTACART_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing INSTACART_API_KEY environment variable.\n' +
        'Sign up at https://docs.instacart.com/developer_platform_api/ to get an API key.',
    )
  }

  const postalCode = process.env.INSTACART_POSTAL_CODE || '94607'
  return { apiKey, postalCode }
}

// --- Response Mapping ---

function mapProduct(raw: InstacartProduct): Product {
  return {
    productId: raw.id,
    name: raw.name,
    description: raw.name,
    brand: raw.brand || '',
    category: raw.category || 'other',
    size: raw.size || '',
    price: raw.price
      ? { regular: raw.price, promo: raw.sale_price }
      : null,
    imageUrl: raw.image_url,
    inStock: raw.in_stock,
  }
}

function mapRetailer(raw: InstacartRetailer): StoreLocation {
  return {
    locationId: raw.id,
    name: raw.name,
    chain: raw.name,
    address: {
      street: raw.address.street,
      city: raw.address.city,
      state: raw.address.state,
      zipCode: raw.address.postal_code,
    },
  }
}

// --- Instacart IDP DeliveryService Implementation ---

export function createInstacartService(): DeliveryService {
  const config = getConfig()

  async function apiFetch(path: string, body?: unknown): Promise<Response> {
    const init: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
    if (body) {
      init.body = JSON.stringify(body)
    }

    const response = await fetch(`${BASE_URL}${path}`, init)

    if (response.status === 429) {
      throw new Error(
        'Instacart API rate limit exceeded. Wait a moment and try again.',
      )
    }

    return response
  }

  return {
    provider: 'instacart',

    async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
      const postalCode = options?.postalCode || config.postalCode
      const limit = options?.limit || 10

      const response = await apiFetch('/products/search', {
        query,
        postal_code: postalCode,
        limit,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Instacart product search failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as InstacartProductSearchResponse
      return data.products.map(mapProduct)
    },

    async getProduct(productId: string): Promise<Product | null> {
      const response = await apiFetch(`/products/${productId}`)

      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Instacart get product failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as { product: InstacartProduct }
      return mapProduct(data.product)
    },

    async createShoppableList(items: ShoppableItem[]): Promise<ShoppableList> {
      const lineItems = items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || undefined,
        product_id: item.productId || undefined,
      }))

      const response = await apiFetch('/shoppable_lists', {
        title: `Grocery Order — ${new Date().toLocaleDateString()}`,
        line_items: lineItems,
        postal_code: config.postalCode,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Instacart create shoppable list failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as InstacartShoppableListResponse
      return {
        listId: data.list_id,
        checkoutUrl: data.shoppable_url,
        matchedItems: data.matched_items.map((m) => ({
          name: m.name,
          matched: m.matched,
          productName: m.product_name || undefined,
        })),
      }
    },

    async searchLocations(zipCode: string, radiusMiles: number = 10): Promise<StoreLocation[]> {
      const params = new URLSearchParams({
        postal_code: zipCode,
        radius: String(radiusMiles),
      })

      const response = await apiFetch(`/retailers?${params}`)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Instacart retailer search failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as InstacartRetailerResponse
      return data.retailers.map(mapRetailer)
    },
  }
}
