import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@grund/db/schema'

/**
 * Seed script for co-parent agent.
 *
 * Run with: bun src/db/seed.ts
 *
 * Populates parents, children, activities, and custody schedule.
 * Edit the values below to match your family's setup.
 */

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = postgres(DATABASE_URL)
const db = drizzle(sql, { schema })

async function seed() {
  console.log('Seeding co-parent agent data...')

  // --- Parents ---
  const [dad] = await db
    .insert(schema.parents)
    .values({
      name: 'Dad',
      phone: process.env.PARENT_1_PHONE || '+15551234567',
      calendarId: process.env.PARENT_1_CALENDAR_ID || 'dad@gmail.com',
      homeLabel: "Dad's",
    })
    .onConflictDoNothing()
    .returning()

  const [mom] = await db
    .insert(schema.parents)
    .values({
      name: 'Mom',
      phone: process.env.PARENT_2_PHONE || '+15559876543',
      calendarId: process.env.PARENT_2_CALENDAR_ID || 'mom@gmail.com',
      homeLabel: "Mom's",
    })
    .onConflictDoNothing()
    .returning()

  if (!dad || !mom) {
    console.log('Parents already exist, fetching...')
    const existingParents = await db.select().from(schema.parents)
    console.log(`Found ${existingParents.length} parents`)
    await sql.end()
    return
  }

  console.log(`Created parents: ${dad.name} (${dad.id}), ${mom.name} (${mom.id})`)

  // --- Children ---
  const [eli] = await db
    .insert(schema.children)
    .values({
      name: 'Eli',
      grade: '3rd',
      school: 'Lincoln Elementary',
    })
    .returning()

  const [milo] = await db
    .insert(schema.children)
    .values({
      name: 'Milo',
      grade: '1st',
      school: 'Lincoln Elementary',
    })
    .returning()

  console.log(`Created children: ${eli.name} (${eli.id}), ${milo.name} (${milo.id})`)

  // --- Activities ---
  const activitiesData = [
    {
      name: 'Flag Football',
      matchPatterns: ['flag football', 'football practice', 'football game'],
      defaultLocation: 'Redwood Fields',
      requiredItems: ['cleats', 'mouthguard', 'water bottle'],
      childIds: [eli.id],
    },
    {
      name: 'Soccer',
      matchPatterns: ['soccer', 'soccer practice', 'soccer game'],
      defaultLocation: 'Redwood Fields',
      requiredItems: ['cleats', 'shin guards', 'water bottle'],
      childIds: [eli.id],
    },
    {
      name: 'Swimming',
      matchPatterns: ['swimming', 'swim practice', 'swim lessons', 'swim class'],
      defaultLocation: 'Oakland YMCA',
      requiredItems: ['goggles', 'towel', 'swim suit'],
      childIds: [milo.id],
    },
    {
      name: 'Piano',
      matchPatterns: ['piano', 'piano lesson', 'piano lessons'],
      defaultLocation: "Mrs. Chen's studio",
      requiredItems: ['piano books'],
      childIds: [eli.id],
    },
  ]

  const insertedActivities = await db.insert(schema.activities).values(activitiesData).returning()
  console.log(`Created ${insertedActivities.length} activities`)

  // --- Custody Schedule ---
  // Example: alternating weeks, Dad has kids weeks starting on even weeks
  // Adjust startDate to your actual custody schedule start
  const custodyData = [
    {
      parentId: dad.id,
      startDate: '2026-01-05', // Monday of week 1
      endDate: '2026-01-11', // Sunday of week 1
      isRecurring: true,
      recurrenceRule: 'every other week starting 2026-01-05',
    },
    {
      parentId: mom.id,
      startDate: '2026-01-12', // Monday of week 2
      endDate: '2026-01-18', // Sunday of week 2
      isRecurring: true,
      recurrenceRule: 'every other week starting 2026-01-12',
    },
  ]

  const insertedCustody = await db.insert(schema.custodyBlocks).values(custodyData).returning()
  console.log(`Created ${insertedCustody.length} custody blocks`)

  console.log('Seed complete!')
  await sql.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
