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

Manages apartment grocery inventory and automates delivery ordering through the Kroger API. Tracks stock levels, flags low/expiring items, and builds optimized carts for delivery.

## Workflow

1. **Check** (`bun check`) — Scan inventory for low-stock and expiring items
2. **Order** (`bun order`) — Build a delivery cart using Claude for smart product selection
3. **Update** (`bun update`) — Add/remove items after shopping or consumption

## Delivery Integration

- **Provider**: Kroger (public API)
- **Capabilities**: Product search, cart assembly, store location lookup
- **Limitation**: Checkout must be completed in Kroger app/browser (no public checkout API)
- **Auth**: OAuth2 — client credentials for search, authorization code for cart operations

## Data Files

- `inventory.json` — Current stock with quantities and expiration dates
- `product-map.json` — Maps inventory item names to Kroger product UPCs
- `orders.json` — History of generated orders/carts
- `preferences.json` — Budget, dietary restrictions, preferred brands/stores
