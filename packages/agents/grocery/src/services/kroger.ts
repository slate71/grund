import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type {
  DeliveryService,
  Product,
  Price,
  StoreLocation,
  SearchOptions,
  AuthTokens,
} from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE_URL = 'https://api.kroger.com/v1'
const TOKEN_URL = `${BASE_URL}/connect/oauth2/token`
const TOKEN_FILE = join(__dirname, '..', '..', '.kroger-tokens.json')

interface KrogerConfig {
  clientId: string
  clientSecret: string
}

// Raw Kroger API response shapes
interface KrogerProductResponse {
  data: KrogerProduct[]
  meta: { pagination: { total: number; start: number; limit: number } }
}

interface KrogerProduct {
  productId: string
  upc: string
  description: string
  brand: string
  categories: string[]
  items: KrogerProductItem[]
  images: KrogerImage[]
}

interface KrogerProductItem {
  size: string
  price?: { regular: number; promo: number }
  fulfillment?: { inStore: boolean; shipToHome: boolean; delivery: boolean }
  inventory?: { stockLevel: string }
}

interface KrogerImage {
  perspective: string
  sizes: { size: string; url: string }[]
}

interface KrogerLocationResponse {
  data: KrogerLocation[]
}

interface KrogerLocation {
  locationId: string
  name: string
  chain: string
  address: {
    addressLine1: string
    city: string
    state: string
    zipCode: string
  }
  phone: string
  departments: { departmentId: string; name: string }[]
}

function getConfig(): KrogerConfig {
  const clientId = process.env.KROGER_CLIENT_ID
  const clientSecret = process.env.KROGER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing KROGER_CLIENT_ID or KROGER_CLIENT_SECRET environment variables.\n' +
        'Register at https://developer.kroger.com to get API credentials.',
    )
  }

  return { clientId, clientSecret }
}

// --- Token Management ---

function loadTokens(): AuthTokens | null {
  if (!existsSync(TOKEN_FILE)) return null
  try {
    const data = readFileSync(TOKEN_FILE, 'utf-8')
    return JSON.parse(data) as AuthTokens
  } catch {
    return null
  }
}

function saveTokens(tokens: AuthTokens): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2))
}

async function getClientCredentialsToken(config: KrogerConfig): Promise<AuthTokens> {
  const cached = loadTokens()
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Kroger auth failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    access_token: string
    token_type: string
    expires_in: number
    scope: string
  }

  const tokens: AuthTokens = {
    accessToken: data.access_token,
    refreshToken: null,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }

  saveTokens(tokens)
  return tokens
}

// --- Response Mapping ---

function mapProduct(raw: KrogerProduct): Product {
  const item = raw.items[0]
  const price: Price | null = item?.price
    ? { regular: item.price.regular, promo: item.price.promo || null }
    : null

  const images = raw.images
    .filter((img) => img.perspective === 'front')
    .flatMap((img) =>
      img.sizes.map((s) => ({
        url: s.url,
        size: s.size as 'small' | 'medium' | 'large' | 'xlarge',
      })),
    )

  const inStock = item?.inventory?.stockLevel !== 'TEMPORARILY_OUT_OF_STOCK'

  return {
    productId: raw.productId,
    upc: raw.upc,
    name: raw.description,
    description: raw.description,
    brand: raw.brand,
    category: raw.categories[0] || 'other',
    size: item?.size || '',
    price,
    images,
    inStock,
  }
}

function mapLocation(raw: KrogerLocation): StoreLocation {
  return {
    locationId: raw.locationId,
    name: raw.name,
    chain: raw.chain,
    address: {
      street: raw.address.addressLine1,
      city: raw.address.city,
      state: raw.address.state,
      zipCode: raw.address.zipCode,
    },
    phone: raw.phone,
    departments: raw.departments.map((d) => d.name),
  }
}

// --- Kroger DeliveryService Implementation ---

export function createKrogerService(): DeliveryService {
  const config = getConfig()

  async function authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
    const tokens = await getClientCredentialsToken(config)
    const headers = {
      ...((init?.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
    }
    return fetch(url, { ...init, headers })
  }

  return {
    provider: 'kroger',

    async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
      const params = new URLSearchParams({ 'filter.term': query })
      if (options?.locationId) params.set('filter.locationId', options.locationId)
      if (options?.limit) params.set('filter.limit', String(options.limit))

      const response = await authenticatedFetch(`${BASE_URL}/products?${params}`)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Kroger product search failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as KrogerProductResponse
      return data.data.map(mapProduct)
    },

    async getProduct(productId: string): Promise<Product | null> {
      const response = await authenticatedFetch(`${BASE_URL}/products/${productId}`)

      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Kroger get product failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as { data: KrogerProduct }
      return mapProduct(data.data)
    },

    async addToCart(upc: string, quantity: number): Promise<void> {
      // Cart operations require user-authorized tokens (authorization code flow).
      // Client credentials tokens won't work here.
      const tokens = loadTokens()
      if (!tokens || !tokens.scope.includes('cart.basic:write')) {
        throw new Error(
          'Cart operations require user authorization.\n' +
            'Run `bun order.ts --auth` to complete the OAuth2 authorization flow.',
        )
      }

      const response = await fetch(`${BASE_URL}/cart/add`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          items: [{ upc, quantity }],
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Kroger add to cart failed (${response.status}): ${text}`)
      }
    },

    async searchLocations(zipCode: string, radiusMiles: number = 10): Promise<StoreLocation[]> {
      const params = new URLSearchParams({
        'filter.zipCode.near': zipCode,
        'filter.radiusInMiles': String(radiusMiles),
        'filter.limit': '5',
      })

      const response = await authenticatedFetch(`${BASE_URL}/locations?${params}`)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Kroger location search failed (${response.status}): ${text}`)
      }

      const data = (await response.json()) as KrogerLocationResponse
      return data.data.map(mapLocation)
    },
  }
}
