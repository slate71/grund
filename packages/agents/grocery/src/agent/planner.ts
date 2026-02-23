import Anthropic from '@anthropic-ai/sdk'
import type { GroceryItem } from '../inventory/types.js'
import type { Preferences } from '../inventory/types.js'
import type { Product } from '../services/types.js'

export interface OrderPlan {
  items: PlannedItem[]
  reasoning: string
  estimatedTotal: number
  warnings: string[]
}

export interface PlannedItem {
  itemId: string
  name: string
  quantity: number
  unit: string
  searchTerm: string
  reason: string // "low stock", "expiring", "regular restock", etc.
}

export interface ProductSelection {
  itemId: string
  selectedProduct: Product
  quantity: number
  reason: string
}

export interface CartReview {
  approved: boolean
  adjustments: string[]
  totalEstimate: number
  summary: string
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable')
  }
  return new Anthropic({ apiKey })
}

export async function planOrder(
  lowStock: GroceryItem[],
  expiring: GroceryItem[],
  preferences: Preferences,
): Promise<OrderPlan> {
  const client = getClient()

  const prompt = `You are a grocery ordering assistant. Based on the inventory data below, create an order plan.

LOW STOCK ITEMS (below reorder threshold):
${JSON.stringify(lowStock, null, 2)}

EXPIRING SOON (need replacement):
${JSON.stringify(expiring, null, 2)}

PREFERENCES:
- Weekly budget: $${preferences.weeklyBudget}
- Dietary restrictions: ${preferences.dietaryRestrictions.join(', ') || 'none'}
- Preferred brands: ${JSON.stringify(preferences.preferredBrands)}

Respond with ONLY valid JSON matching this structure (no markdown, no code fences):
{
  "items": [
    {
      "itemId": "the item id",
      "name": "display name",
      "quantity": 1,
      "unit": "unit of measure",
      "searchTerm": "search query for grocery store API",
      "reason": "why ordering this"
    }
  ],
  "reasoning": "brief explanation of the overall plan",
  "estimatedTotal": 0,
  "warnings": ["any budget concerns or notes"]
}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type from Claude')

  return JSON.parse(text.text) as OrderPlan
}

export async function selectProduct(
  item: PlannedItem,
  candidates: Product[],
  preferences: Preferences,
): Promise<ProductSelection | null> {
  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    return {
      itemId: item.itemId,
      selectedProduct: candidates[0],
      quantity: item.quantity,
      reason: `Only match for "${item.searchTerm}"`,
    }
  }

  const client = getClient()

  const prompt = `You are selecting a grocery product. Pick the best match.

LOOKING FOR: ${item.name} (${item.quantity} ${item.unit})
PREFERRED BRAND: ${preferences.preferredBrands[item.name] || 'no preference'}
DIETARY RESTRICTIONS: ${preferences.dietaryRestrictions.join(', ') || 'none'}

CANDIDATES:
${candidates.map((p, i) => `${i + 1}. ${p.name} — ${p.brand} — ${p.size} — $${p.price?.regular ?? '?'}${p.price?.promo ? ` (sale: $${p.price.promo})` : ''} — ${p.inStock ? 'in stock' : 'OUT OF STOCK'}`).join('\n')}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "selectedIndex": <1-based index of best product>,
  "reason": "why this one"
}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type from Claude')

  const result = JSON.parse(text.text) as { selectedIndex: number; reason: string }
  const selected = candidates[result.selectedIndex - 1]

  if (!selected) return null

  return {
    itemId: item.itemId,
    selectedProduct: selected,
    quantity: item.quantity,
    reason: result.reason,
  }
}

export async function reviewCart(
  selections: ProductSelection[],
  preferences: Preferences,
): Promise<CartReview> {
  const client = getClient()

  const totalEstimate = selections.reduce((sum, s) => {
    const price = s.selectedProduct.price?.promo ?? s.selectedProduct.price?.regular ?? 0
    return sum + price * s.quantity
  }, 0)

  const prompt = `You are reviewing a grocery cart before submission.

CART:
${selections.map((s) => {
  const price = s.selectedProduct.price?.promo ?? s.selectedProduct.price?.regular ?? 0
  return `- ${s.selectedProduct.name} x${s.quantity} — $${(price * s.quantity).toFixed(2)} (${s.reason})`
}).join('\n')}

ESTIMATED TOTAL: $${totalEstimate.toFixed(2)}
WEEKLY BUDGET: $${preferences.weeklyBudget}
DIETARY RESTRICTIONS: ${preferences.dietaryRestrictions.join(', ') || 'none'}

Check for:
1. Budget compliance
2. Duplicate or redundant items
3. Dietary restriction violations
4. Anything that looks wrong

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "approved": true/false,
  "adjustments": ["suggested changes if any"],
  "totalEstimate": ${totalEstimate.toFixed(2)},
  "summary": "one-line summary of the cart"
}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type from Claude')

  return JSON.parse(text.text) as CartReview
}
