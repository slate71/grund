#!/usr/bin/env bun

// Order orchestrator — the main delivery agent script
// Reads inventory → identifies needs → uses Claude to plan → searches products → builds cart
//
// Usage:
//   bun order.ts              # Plan and build cart (requires confirmation)
//   bun order.ts --dry-run    # Plan only, don't add to cart
//   bun order.ts --mock       # Use mock delivery service (no API keys needed)

import {
  loadInventory,
  loadProductMap,
  saveProductMap,
  loadOrders,
  saveOrders,
  loadPreferences,
  getLowStockItems,
  getExpiringItems,
  getProductMapping,
} from './src/inventory/helpers.js'
import { planOrder, selectProduct, reviewCart } from './src/agent/planner.js'
import type { DeliveryService } from './src/services/types.js'
import type { ProductSelection } from './src/agent/planner.js'
import type { OrderRecord, OrderItem } from './src/inventory/types.js'
import { createInterface } from 'readline'

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

async function getService(useMock: boolean): Promise<DeliveryService> {
  if (useMock) {
    const { createMockService } = await import('./src/services/mock.js')
    return createMockService()
  }
  const { createKrogerService } = await import('./src/services/kroger.js')
  return createKrogerService()
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const useMock = process.argv.includes('--mock')

  console.log('\n  GROCERY ORDER AGENT')
  console.log('─'.repeat(50))

  if (dryRun) console.log('  Mode: DRY RUN (no cart changes)')
  if (useMock) console.log('  Mode: MOCK SERVICE (no real API calls)')

  // 1. Load state
  console.log('\n  Loading inventory...')
  const inventory = loadInventory()
  const preferences = loadPreferences()
  const productMap = loadProductMap()

  const lowStock = getLowStockItems(inventory)
  const expiring = getExpiringItems(inventory, 3)

  if (lowStock.length === 0 && expiring.length === 0) {
    console.log('  Nothing to order — inventory looks good.')
    return
  }

  console.log(`  Found ${lowStock.length} low-stock and ${expiring.length} expiring items.`)

  // 2. Ask Claude to plan the order
  console.log('\n  Planning order with Claude...')
  const plan = planOrder(lowStock, expiring, preferences)
  const orderPlan = await plan

  console.log(`\n  ORDER PLAN: ${orderPlan.reasoning}`)
  console.log(`  Items to order: ${orderPlan.items.length}`)
  console.log(`  Estimated total: $${orderPlan.estimatedTotal}`)

  if (orderPlan.warnings.length > 0) {
    console.log(`  Warnings:`)
    for (const w of orderPlan.warnings) console.log(`    - ${w}`)
  }

  for (const item of orderPlan.items) {
    console.log(`    - ${item.name} x${item.quantity} ${item.unit} (${item.reason})`)
  }

  // 3. Search for products
  console.log('\n  Searching for products...')
  const service = await getService(useMock)
  const selections: ProductSelection[] = []

  for (const item of orderPlan.items) {
    // Check for existing product mapping first
    const mapping = getProductMapping(productMap, item.itemId)
    let searchTerm = item.searchTerm

    if (mapping?.kroger) {
      // We have a known product — try to get it directly
      const product = await service.getProduct(mapping.kroger.productId)
      if (product && product.inStock) {
        selections.push({
          itemId: item.itemId,
          selectedProduct: product,
          quantity: item.quantity,
          reason: `Mapped product: ${mapping.kroger.name}`,
        })
        console.log(`    [mapped] ${item.name} -> ${product.name}`)
        continue
      }
      // Mapped product unavailable, fall through to search
      searchTerm = mapping.fallbackSearchTerm
    }

    // Search for candidates
    const locationId = preferences.preferredStore?.locationId
    const candidates = await service.searchProducts(searchTerm, {
      locationId,
      limit: 5,
    })

    if (candidates.length === 0) {
      console.log(`    [no results] ${item.name} — "${searchTerm}" returned nothing`)
      continue
    }

    // Let Claude pick the best match
    const selection = await selectProduct(item, candidates, preferences)
    if (selection) {
      selections.push(selection)
      console.log(
        `    [selected] ${item.name} -> ${selection.selectedProduct.name} ($${selection.selectedProduct.price?.regular ?? '?'})`,
      )

      // Save the mapping for next time
      const existingIdx = productMap.mappings.findIndex((m) => m.itemId === item.itemId)
      const newMapping = {
        itemId: item.itemId,
        itemName: item.name,
        kroger: {
          upc: selection.selectedProduct.upc,
          productId: selection.selectedProduct.productId,
          name: selection.selectedProduct.name,
          size: selection.selectedProduct.size,
        },
        fallbackSearchTerm: searchTerm,
      }
      if (existingIdx >= 0) {
        productMap.mappings[existingIdx] = newMapping
      } else {
        productMap.mappings.push(newMapping)
      }
    } else {
      console.log(`    [skipped] ${item.name} — no suitable product found`)
    }
  }

  if (selections.length === 0) {
    console.log('\n  No products selected. Nothing to order.')
    return
  }

  // 4. Review cart with Claude
  console.log('\n  Reviewing cart...')
  const review = await reviewCart(selections, preferences)

  console.log(`\n  CART REVIEW: ${review.summary}`)
  console.log(`  Estimated total: $${review.totalEstimate.toFixed(2)}`)
  console.log(`  Approved: ${review.approved ? 'yes' : 'no'}`)

  if (review.adjustments.length > 0) {
    console.log(`  Suggestions:`)
    for (const adj of review.adjustments) console.log(`    - ${adj}`)
  }

  if (!review.approved) {
    console.log('\n  Claude flagged issues with this cart. Review suggestions above.')
  }

  if (dryRun) {
    console.log('\n  DRY RUN complete — no changes made.')
    saveProductMap(productMap) // Still save learned product mappings
    return
  }

  // 5. Confirm with user
  const proceed = await confirm('\n  Add these items to your Kroger cart?')
  if (!proceed) {
    console.log('  Cancelled.')
    saveProductMap(productMap)
    return
  }

  // 6. Add to cart
  console.log('\n  Adding items to cart...')
  const orderItems: OrderItem[] = []

  for (const selection of selections) {
    try {
      await service.addToCart(selection.selectedProduct.upc, selection.quantity)
      console.log(`    [added] ${selection.selectedProduct.name} x${selection.quantity}`)
      orderItems.push({
        itemId: selection.itemId,
        name: selection.selectedProduct.name,
        quantity: selection.quantity,
        unit: selection.selectedProduct.size,
        upc: selection.selectedProduct.upc,
        price: selection.selectedProduct.price?.promo ?? selection.selectedProduct.price?.regular ?? null,
      })
    } catch (err) {
      console.error(`    [failed] ${selection.selectedProduct.name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  // 7. Record the order
  const orders = loadOrders()
  const order: OrderRecord = {
    id: `order-${Date.now()}`,
    createdAt: new Date().toISOString(),
    items: orderItems,
    estimatedTotal: review.totalEstimate,
    store: preferences.preferredStore?.name ?? null,
    status: 'cart-built',
    notes: review.summary,
  }
  orders.orders.push(order)
  saveOrders(orders)
  saveProductMap(productMap)

  console.log(`\n  Cart built. Order ${order.id} saved.`)
  console.log('  Complete checkout in the Kroger app or at kroger.com')
  console.log('─'.repeat(50) + '\n')
}

main().catch((err) => {
  console.error('Order failed:', err)
  process.exit(1)
})
