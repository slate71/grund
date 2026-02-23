---
last_check: 2026-02-23
items_tracked: 0
low_stock_count: 0
next_shop_date: null
weekly_budget: 150
preferred_store: null
---

# Grocery Inventory Agent Context

## Purpose

Manages apartment grocery inventory and automates delivery ordering through Instacart. Tracks stock levels, flags low/expiring items, and builds optimized shoppable lists for delivery.

## Workflow

1. **Check** (`bun check`) — Scan inventory for low-stock and expiring items
2. **Order** (`bun order`) — Build a shoppable list using Claude for smart product selection
3. **Update** (`bun update`) — Add/remove items after shopping or consumption

## Delivery Integration

- **Provider**: Instacart Developer Platform (IDP)
- **Capabilities**: Product search, shoppable list creation, retailer lookup
- **Flow**: Agent builds a shoppable list → Instacart returns a checkout URL → user completes checkout on Instacart
- **Auth**: API key (`INSTACART_API_KEY`)
- **Location**: Oakland, CA 94607 (`INSTACART_POSTAL_CODE`)

## Data Files

- `inventory.json` — Current stock with quantities and expiration dates
- `product-map.json` — Maps inventory item names to Instacart product IDs (learned over time)
- `orders.json` — History of generated orders/carts
- `preferences.json` — Budget, dietary restrictions, preferred brands/stores

## Environment Variables

- `INSTACART_API_KEY` — Instacart Developer Platform API key
- `INSTACART_POSTAL_CODE` — Delivery postal code (default: 94607)
- `ANTHROPIC_API_KEY` — Claude API key (for order planning)
- `ANTHROPIC_MODEL` — Claude model override (default: claude-sonnet-4-20250514)
