import type { FastifyInstance } from 'fastify'
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm'
import { events, classifications } from '@grund/db'
import type { Database } from '@grund/db'
import type {
  CreateEventBody,
  Outcome,
  EventWithClassification,
  PaginatedResponse,
} from '@grund/shared'
import { classifyConversation } from './classify'

export function registerRoutes(app: FastifyInstance, db: Database) {
  app.post<{ Body: CreateEventBody }>('/api/events', async (request, reply) => {
    const { source, conversation_id, messages, metadata } = request.body

    if (!source || !conversation_id || !messages?.length) {
      return reply.status(400).send({ error: 'source, conversation_id, and messages are required' })
    }

    const [event] = await db
      .insert(events)
      .values({
        source,
        conversation_id,
        messages,
        metadata: metadata ?? {},
      })
      .returning()

    // Trigger async classification — don't await to keep response fast
    classifyConversation(messages)
      .then(async (result) => {
        await db.insert(classifications).values({
          event_id: event.id,
          outcome: result.outcome,
          confidence: result.confidence,
          reason: result.reason,
          signals: result.signals,
        })
      })
      .catch((err) => {
        console.error(`Classification failed for event ${event.id}:`, err)
      })

    return reply.status(201).send({ id: event.id })
  })

  app.get<{
    Querystring: {
      outcome?: Outcome
      source?: string
      from?: string
      to?: string
      page?: string
      limit?: string
    }
  }>('/api/events', async (request) => {
    const { outcome, source, from, to, page: pageStr = '1', limit: limitStr = '20' } = request.query

    const page = Math.max(1, parseInt(pageStr, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20))
    const offset = (page - 1) * limit

    const conditions = []

    if (source) {
      conditions.push(eq(events.source, source))
    }
    if (from) {
      conditions.push(gte(events.created_at, new Date(from)))
    }
    if (to) {
      conditions.push(lte(events.created_at, new Date(to)))
    }
    if (outcome) {
      conditions.push(eq(classifications.outcome, outcome))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const baseQuery = db
      .select()
      .from(events)
      .leftJoin(classifications, eq(events.id, classifications.event_id))

    const [rows, totalResult] = await Promise.all([
      where
        ? baseQuery.where(where).orderBy(desc(events.created_at)).limit(limit).offset(offset)
        : baseQuery.orderBy(desc(events.created_at)).limit(limit).offset(offset),
      where
        ? db
            .select({ count: count() })
            .from(events)
            .leftJoin(classifications, eq(events.id, classifications.event_id))
            .where(where)
        : db
            .select({ count: count() })
            .from(events)
            .leftJoin(classifications, eq(events.id, classifications.event_id)),
    ])

    const total = totalResult[0]?.count ?? 0

    const data: EventWithClassification[] = rows.map((row) => ({
      id: row.events.id,
      source: row.events.source,
      conversation_id: row.events.conversation_id,
      messages: row.events.messages as EventWithClassification['messages'],
      metadata: row.events.metadata as EventWithClassification['metadata'],
      created_at: row.events.created_at.toISOString(),
      classification: row.classifications
        ? {
            id: row.classifications.id,
            event_id: row.classifications.event_id,
            outcome: row.classifications.outcome,
            confidence: row.classifications.confidence,
            reason: row.classifications.reason,
            signals: row.classifications.signals as string[],
            created_at: row.classifications.created_at.toISOString(),
          }
        : null,
    }))

    const response: PaginatedResponse<EventWithClassification> = {
      data,
      total,
      page,
      limit,
    }

    return response
  })

  app.get<{ Params: { id: string } }>('/api/events/:id', async (request, reply) => {
    const { id } = request.params

    const rows = await db
      .select()
      .from(events)
      .leftJoin(classifications, eq(events.id, classifications.event_id))
      .where(eq(events.id, id))
      .limit(1)

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    const row = rows[0]
    const event: EventWithClassification = {
      id: row.events.id,
      source: row.events.source,
      conversation_id: row.events.conversation_id,
      messages: row.events.messages as EventWithClassification['messages'],
      metadata: row.events.metadata as EventWithClassification['metadata'],
      created_at: row.events.created_at.toISOString(),
      classification: row.classifications
        ? {
            id: row.classifications.id,
            event_id: row.classifications.event_id,
            outcome: row.classifications.outcome,
            confidence: row.classifications.confidence,
            reason: row.classifications.reason,
            signals: row.classifications.signals as string[],
            created_at: row.classifications.created_at.toISOString(),
          }
        : null,
    }

    return event
  })
}
