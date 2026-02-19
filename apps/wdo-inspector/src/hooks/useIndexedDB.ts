import { openDB, type DBSchema } from 'idb'
import type { WDOReport } from '../types/report'

interface WDODatabase extends DBSchema {
  reports: {
    key: string
    value: {
      id: string
      report: WDOReport
      updatedAt: number
    }
  }
}

const DB_NAME = 'wdo-inspector'
const DB_VERSION = 1
const DRAFT_KEY = 'current-draft'

function getDB() {
  return openDB<WDODatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' })
      }
    },
  })
}

export async function saveDraft(report: WDOReport): Promise<void> {
  const db = await getDB()
  await db.put('reports', {
    id: DRAFT_KEY,
    report,
    updatedAt: Date.now(),
  })
}

export async function loadDraft(): Promise<WDOReport | null> {
  const db = await getDB()
  const entry = await db.get('reports', DRAFT_KEY)
  return entry?.report ?? null
}

export async function clearDraft(): Promise<void> {
  const db = await getDB()
  await db.delete('reports', DRAFT_KEY)
}
