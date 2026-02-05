export type Outcome = 'success' | 'failure' | 'escalation' | 'unclear'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface EventMetadata {
  customer_id?: string
  timestamp?: string
  [key: string]: unknown
}

export interface Event {
  id: string
  source: string
  conversation_id: string
  messages: Message[]
  metadata: EventMetadata
  created_at: string
}

export interface Classification {
  id: string
  event_id: string
  outcome: Outcome
  confidence: number
  reason: string
  signals: string[]
  created_at: string
}

export interface EventWithClassification {
  id: string
  source: string
  conversation_id: string
  messages: Message[]
  metadata: EventMetadata | Record<string, unknown> | null
  created_at: Date | string
  outcome?: Outcome | null
  confidence?: number | null
  reason?: string | null
  signals?: string[] | null
}

export interface CreateEventBody {
  source: string
  conversation_id: string
  messages: Message[]
  metadata?: EventMetadata
}

export interface ClassificationResult {
  outcome: Outcome
  confidence: number
  reason: string
  signals: string[]
}

export interface EventsQuery {
  outcome?: Outcome
  source?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  totalPages: number
  page: number
  limit: number
}
