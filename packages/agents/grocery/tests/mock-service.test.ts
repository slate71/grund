import { describe, it, expect } from 'vitest'
import { createMockService } from '../src/services/mock.js'

describe('mock delivery service', () => {
  it('searches products by keyword', async () => {
    const service = createMockService()
    const results = await service.searchProducts('milk')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name.toLowerCase()).toContain('milk')
  })

  it('searches products by category', async () => {
    const service = createMockService()
    const results = await service.searchProducts('produce')
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns empty for no match', async () => {
    const service = createMockService()
    const results = await service.searchProducts('xyznonexistent')
    expect(results).toEqual([])
  })

  it('gets a product by id', async () => {
    const service = createMockService()
    const product = await service.getProduct('mock-001')
    expect(product).not.toBeNull()
    expect(product!.productId).toBe('mock-001')
  })

  it('returns null for unknown product id', async () => {
    const service = createMockService()
    const product = await service.getProduct('unknown')
    expect(product).toBeNull()
  })

  it('creates a shoppable list with matched items', async () => {
    const service = createMockService()
    const list = await service.createShoppableList([
      { name: 'milk', quantity: 1 },
      { name: 'banana', quantity: 6 },
      { name: 'xyznonexistent', quantity: 1 },
    ])
    expect(list.listId).toBeTruthy()
    expect(list.checkoutUrl).toBeTruthy()
    expect(list.matchedItems).toHaveLength(3)
    expect(list.matchedItems[0].matched).toBe(true)
    expect(list.matchedItems[1].matched).toBe(true)
    expect(list.matchedItems[2].matched).toBe(false)
  })

  it('searches locations', async () => {
    const service = createMockService()
    const locations = await service.searchLocations('94607')
    expect(locations.length).toBeGreaterThan(0)
    expect(locations[0].locationId).toBeTruthy()
  })

  it('exposes provider name', () => {
    const service = createMockService()
    expect(service.provider).toBe('mock')
  })
})
