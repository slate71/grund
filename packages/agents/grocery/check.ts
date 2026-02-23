#!/usr/bin/env bun

// Inventory check — scans for low-stock, expiring, and expired items
// Usage: bun check.ts [--json]

import {
  loadInventory,
  getLowStockItems,
  getExpiringItems,
  getExpiredItems,
  summarizeInventory,
} from './src/inventory/helpers.js'

function main(): void {
  const jsonOutput = process.argv.includes('--json')

  const inventory = loadInventory()
  const summary = summarizeInventory(inventory)
  const lowStock = getLowStockItems(inventory)
  const expiringSoon = getExpiringItems(inventory, 3)
  const expired = getExpiredItems(inventory)

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          summary,
          lowStock: lowStock.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, reorderAt: i.reorderAt })),
          expiringSoon: expiringSoon.map((i) => ({ id: i.id, name: i.name, expiresAt: i.expiresAt })),
          expired: expired.map((i) => ({ id: i.id, name: i.name, expiresAt: i.expiresAt })),
        },
        null,
        2,
      ),
    )
    return
  }

  const sep = '─'.repeat(50)

  console.log(`\n${sep}`)
  console.log(`  GROCERY INVENTORY CHECK`)
  console.log(`  ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)
  console.log(sep)

  console.log(`\n  Total items tracked: ${summary.total}`)
  console.log(`  Categories: ${Object.entries(summary.byCategory).map(([k, v]) => `${k}(${v})`).join(', ')}`)

  // Low stock
  if (lowStock.length > 0) {
    console.log(`\n  LOW STOCK (${lowStock.length} items):`)
    for (const item of lowStock) {
      const status = item.quantity === 0 ? 'OUT' : `${item.quantity} ${item.unit}`
      console.log(`    - ${item.name}: ${status} (reorder at ${item.reorderAt})`)
    }
  } else {
    console.log('\n  Low stock: none')
  }

  // Expiring soon
  if (expiringSoon.length > 0) {
    console.log(`\n  EXPIRING SOON (${expiringSoon.length} items, within 3 days):`)
    for (const item of expiringSoon) {
      console.log(`    - ${item.name}: expires ${item.expiresAt}`)
    }
  } else {
    console.log('  Expiring soon: none')
  }

  // Already expired
  if (expired.length > 0) {
    console.log(`\n  EXPIRED (${expired.length} items):`)
    for (const item of expired) {
      console.log(`    - ${item.name}: expired ${item.expiresAt} (${item.quantity} ${item.unit} remaining)`)
    }
  } else {
    console.log('  Expired: none')
  }

  // Action needed?
  const actionNeeded = lowStock.length > 0 || expiringSoon.length > 0 || expired.length > 0
  if (actionNeeded) {
    console.log(`\n  --> Run \`bun order\` to build a delivery cart`)
  } else {
    console.log(`\n  Everything looks good.`)
  }

  console.log(`${sep}\n`)
}

main()
