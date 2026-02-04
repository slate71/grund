import type { EventWithClassification, PaginatedResponse, Outcome } from '@grund/shared'

const BASE = '/api'

export async function fetchEvents(params?: {
  outcome?: Outcome
  page?: number
  limit?: number
}): Promise<PaginatedResponse<EventWithClassification>> {
  const search = new URLSearchParams()
  if (params?.outcome) search.set('outcome', params.outcome)
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))

  const qs = search.toString()
  const res = await fetch(`${BASE}/events${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`)
  return res.json()
}

export async function fetchEvent(id: string): Promise<EventWithClassification> {
  const res = await fetch(`${BASE}/events/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.statusText}`)
  return res.json()
}
