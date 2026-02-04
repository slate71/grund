import { useEffect, useState, useCallback } from 'react'
import type { EventWithClassification, Outcome } from '@grund/shared'
import { fetchEvents } from './api'
import { FilterBar } from './components/FilterBar'
import { EventList } from './components/EventList'
import { EventDetail } from './components/EventDetail'

export function App() {
  const [events, setEvents] = useState<EventWithClassification[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<Outcome | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchEvents({ outcome: filter, limit: 50 })
      setEvents(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  if (selectedId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EventDetail eventId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Event Feed</h1>
        <p className="mt-1 text-sm text-gray-500">
          {total} classified interaction{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-4">
        <FilterBar active={filter} onChange={setFilter} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-gray-500">Loading...</p>
      ) : (
        <EventList events={events} onSelect={setSelectedId} />
      )}
    </div>
  )
}
