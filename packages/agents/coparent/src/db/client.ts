import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@grund/db/schema'
import { config } from '../config'

const sql = postgres(config.database.url)
export const db = drizzle(sql, { schema })

export { schema }
