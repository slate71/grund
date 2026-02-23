#!/usr/bin/env bun

// Inventory mutation CLI — add, remove, and restock items
//
// Usage:
//   bun update.ts add "whole milk" --qty 1 --unit gallon --category dairy --expires 2026-03-01
//   bun update.ts remove "whole milk" --qty 1
//   bun update.ts restock <order-id>    # Mark order items as received, add to inventory
//   bun update.ts expire                # Remove all expired items
//   bun update.ts list                  # List all inventory items

import {
  loadInventory,
  saveInventory,
  loadOrders,
  saveOrders,
  loadHistory,
  saveHistory,
  addHistoryEntry,
  findItem,
  createItemId,
  getExpiredItems,
} from './src/inventory/helpers.js'
import type { GroceryItem, Category } from './src/inventory/types.js'

function parseArgs(): { command: string; args: string[]; flags: Record<string, string> } {
  const rawArgs = process.argv.slice(2)
  const command = rawArgs[0] || 'list'
  const args: string[] = []
  const flags: Record<string, string> = {}

  for (let i = 1; i < rawArgs.length; i++) {
    if (rawArgs[i].startsWith('--')) {
      const key = rawArgs[i].slice(2)
      flags[key] = rawArgs[i + 1] || ''
      i++
    } else {
      args.push(rawArgs[i])
    }
  }

  return { command, args, flags }
}

function main(): void {
  const { command, args, flags } = parseArgs()

  switch (command) {
    case 'add':
      addItem(args[0], flags)
      break
    case 'remove':
      removeItem(args[0], flags)
      break
    case 'restock':
      restockFromOrder(args[0])
      break
    case 'expire':
      removeExpired()
      break
    case 'list':
      listItems()
      break
    default:
      console.log(`Unknown command: ${command}`)
      console.log('Commands: add, remove, restock, expire, list')
      process.exit(1)
  }
}

function addItem(name: string | undefined, flags: Record<string, string>): void {
  if (!name) {
    console.error('Usage: bun update.ts add "item name" --qty 1 --unit gallon [--category dairy] [--expires 2026-03-01] [--brand "Brand"] [--reorder 1]')
    process.exit(1)
  }

  const inventory = loadInventory()
  const history = loadHistory()
  const existing = findItem(inventory, name)

  if (existing) {
    // Add to existing item quantity
    const addQty = parseInt(flags.qty || '1')
    existing.quantity += addQty
    existing.lastUpdated = new Date().toISOString()
    if (flags.expires) existing.expiresAt = flags.expires

    addHistoryEntry(history, {
      action: 'add',
      itemId: existing.id,
      itemName: existing.name,
      quantityChange: addQty,
      quantityAfter: existing.quantity,
    })

    saveInventory(inventory)
    saveHistory(history)
    console.log(`Updated ${existing.name}: now ${existing.quantity} ${existing.unit}`)
    return
  }

  // Create new item
  const item: GroceryItem = {
    id: createItemId(name),
    name,
    category: (flags.category as Category) || 'other',
    quantity: parseInt(flags.qty || '1'),
    unit: flags.unit || 'count',
    expiresAt: flags.expires || null,
    reorderAt: parseInt(flags.reorder || '1'),
    preferredBrand: flags.brand || null,
    notes: flags.notes || null,
    lastUpdated: new Date().toISOString(),
  }

  inventory.items.push(item)

  addHistoryEntry(history, {
    action: 'add',
    itemId: item.id,
    itemName: item.name,
    quantityChange: item.quantity,
    quantityAfter: item.quantity,
  })

  saveInventory(inventory)
  saveHistory(history)
  console.log(`Added ${item.name}: ${item.quantity} ${item.unit} (${item.category})`)
}

function removeItem(name: string | undefined, flags: Record<string, string>): void {
  if (!name) {
    console.error('Usage: bun update.ts remove "item name" [--qty 1]')
    process.exit(1)
  }

  const inventory = loadInventory()
  const history = loadHistory()
  const item = findItem(inventory, name)

  if (!item) {
    console.error(`Item not found: ${name}`)
    process.exit(1)
  }

  const removeQty = parseInt(flags.qty || String(item.quantity))
  item.quantity = Math.max(0, item.quantity - removeQty)
  item.lastUpdated = new Date().toISOString()

  addHistoryEntry(history, {
    action: 'remove',
    itemId: item.id,
    itemName: item.name,
    quantityChange: -removeQty,
    quantityAfter: item.quantity,
  })

  saveInventory(inventory)
  saveHistory(history)
  console.log(`Removed ${removeQty} ${item.unit} of ${item.name}: now ${item.quantity} ${item.unit}`)
}

function restockFromOrder(orderId: string | undefined): void {
  if (!orderId) {
    console.error('Usage: bun update.ts restock <order-id>')
    process.exit(1)
  }

  const orders = loadOrders()
  const order = orders.orders.find((o) => o.id === orderId)

  if (!order) {
    console.error(`Order not found: ${orderId}`)
    console.log('Recent orders:')
    for (const o of orders.orders.slice(-5)) {
      console.log(`  ${o.id} — ${o.createdAt} — ${o.status} — ${o.items.length} items`)
    }
    process.exit(1)
  }

  const inventory = loadInventory()
  const history = loadHistory()
  let restocked = 0

  for (const orderItem of order.items) {
    const invItem = findItem(inventory, orderItem.itemId) || findItem(inventory, orderItem.name)

    if (invItem) {
      invItem.quantity += orderItem.quantity
      invItem.lastUpdated = new Date().toISOString()

      addHistoryEntry(history, {
        action: 'restock',
        itemId: invItem.id,
        itemName: invItem.name,
        quantityChange: orderItem.quantity,
        quantityAfter: invItem.quantity,
      })

      restocked++
      console.log(`  Restocked ${invItem.name}: +${orderItem.quantity} -> ${invItem.quantity} ${invItem.unit}`)
    } else {
      console.log(`  Skipped ${orderItem.name} (not in inventory — use 'add' first)`)
    }
  }

  order.status = 'delivered'
  saveInventory(inventory)
  saveOrders(orders)
  saveHistory(history)
  console.log(`\nRestocked ${restocked}/${order.items.length} items from order ${orderId}`)
}

function removeExpired(): void {
  const inventory = loadInventory()
  const history = loadHistory()
  const expired = getExpiredItems(inventory)

  if (expired.length === 0) {
    console.log('No expired items.')
    return
  }

  for (const item of expired) {
    addHistoryEntry(history, {
      action: 'expire',
      itemId: item.id,
      itemName: item.name,
      quantityChange: -item.quantity,
      quantityAfter: 0,
    })

    item.quantity = 0
    item.lastUpdated = new Date().toISOString()
    console.log(`  Expired: ${item.name} (was ${item.expiresAt})`)
  }

  saveInventory(inventory)
  saveHistory(history)
  console.log(`\nMarked ${expired.length} items as expired (quantity set to 0)`)
}

function listItems(): void {
  const inventory = loadInventory()

  if (inventory.items.length === 0) {
    console.log('Inventory is empty. Use `bun update.ts add "item"` to add items.')
    return
  }

  console.log(`\n  INVENTORY (${inventory.items.length} items)`)
  console.log('─'.repeat(50))

  // Group by category
  const byCategory = new Map<string, GroceryItem[]>()
  for (const item of inventory.items) {
    const list = byCategory.get(item.category) || []
    list.push(item)
    byCategory.set(item.category, list)
  }

  for (const [category, items] of byCategory) {
    console.log(`\n  ${category.toUpperCase()}:`)
    for (const item of items) {
      const qty = item.quantity === 0 ? 'OUT' : `${item.quantity} ${item.unit}`
      const exp = item.expiresAt ? ` (exp: ${item.expiresAt})` : ''
      const brand = item.preferredBrand ? ` [${item.preferredBrand}]` : ''
      console.log(`    ${item.name}: ${qty}${exp}${brand}`)
    }
  }
  console.log('')
}

main()
