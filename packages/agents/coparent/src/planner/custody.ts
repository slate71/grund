import { eq } from 'drizzle-orm'
import { db, schema } from '../db/client'
import type { CustodyBlock, Parent } from '../models/types'

/**
 * Determine which parent has custody on a given date.
 *
 * Strategy:
 * 1. Check for non-recurring blocks that explicitly cover the date (overrides/exceptions)
 * 2. Check recurring blocks — compute which weeks fall on the date using the recurrence rule
 */
export async function getCustodyParent(date: string): Promise<Parent | null> {
  const allBlocks = await db.select().from(schema.custodyBlocks)
  const allParents = await db.select().from(schema.parents)

  const parentMap = new Map(allParents.map((p) => [p.id, p]))

  // First: check for explicit (non-recurring) blocks covering this date
  const explicitBlock = allBlocks.find(
    (b) => !b.isRecurring && date >= b.startDate && date <= b.endDate,
  )

  if (explicitBlock) {
    return parentMap.get(explicitBlock.parentId) || null
  }

  // Second: evaluate recurring blocks
  for (const block of allBlocks.filter((b) => b.isRecurring)) {
    if (isDateInRecurringBlock(date, block)) {
      return parentMap.get(block.parentId) || null
    }
  }

  return null
}

/**
 * Check if custody switches on this date (different parent than yesterday).
 * Returns the new custody parent if a switch happens, null otherwise.
 */
export async function checkCustodySwitch(
  date: string,
): Promise<{ switching: boolean; newParent: Parent | null }> {
  const yesterday = getPreviousDate(date)
  const [todayParent, yesterdayParent] = await Promise.all([
    getCustodyParent(date),
    getCustodyParent(yesterday),
  ])

  if (!todayParent || !yesterdayParent) {
    return { switching: false, newParent: todayParent }
  }

  return {
    switching: todayParent.id !== yesterdayParent.id,
    newParent: todayParent,
  }
}

/** Get all parents from the database */
export async function getAllParents(): Promise<Parent[]> {
  return db.select().from(schema.parents)
}

/** Get a parent by phone number */
export async function getParentByPhone(phone: string): Promise<Parent | null> {
  const results = await db.select().from(schema.parents).where(eq(schema.parents.phone, phone))
  return results[0] || null
}

/**
 * Determine if a date falls within a recurring custody block.
 *
 * Supports the pattern "every other week starting YYYY-MM-DD".
 * The block's startDate/endDate define the first occurrence (e.g., Mon-Sun).
 * The recurrence repeats every 2 weeks from that anchor.
 */
function isDateInRecurringBlock(date: string, block: CustodyBlock): boolean {
  if (!block.recurrenceRule) return false

  const rule = block.recurrenceRule.toLowerCase()

  if (rule.startsWith('every other week starting')) {
    const anchorStart = new Date(block.startDate + 'T12:00:00')
    const targetDate = new Date(date + 'T12:00:00')

    // Calculate the block duration in days
    const blockStart = new Date(block.startDate + 'T12:00:00')
    const blockEnd = new Date(block.endDate + 'T12:00:00')
    const blockDuration = Math.round(
      (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60 * 60 * 24),
    )

    // Days since anchor start
    const daysSinceAnchor = Math.round(
      (targetDate.getTime() - anchorStart.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (daysSinceAnchor < 0) return false

    // Every other week = 14-day cycle
    const cycleDay = daysSinceAnchor % 14

    // The block is active for days 0 through blockDuration
    return cycleDay >= 0 && cycleDay <= blockDuration
  }

  // Fallback: simple date range check
  return date >= block.startDate && date <= block.endDate
}

function getPreviousDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
