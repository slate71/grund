import type { FastifyInstance } from 'fastify'
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm'
import { events, classifications } from '@grund/db'
import type { Database } from '@grund/db'
import type {
  CreateEventBody,
  Outcome,
  EventWithClassification,
  PaginatedResponse,
  Message,
} from '@grund/shared'
import { classifyConversation } from '../classify'

export function registerEventRoutes(app: FastifyInstance, db: Database) {
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
      page?: number
      limit?: number
      outcome?: Outcome
      source?: string
      from?: string
      to?: string
      min_confidence?: number
      max_confidence?: number
    }
  }>('/api/events', async (request, reply) => {
    const {
      page = 1,
      limit = 20,
      outcome,
      source,
      from,
      to,
      min_confidence,
      max_confidence,
    } = request.query

    const offset = (page - 1) * limit

    const conditions = []
    if (source) conditions.push(eq(events.source, source))
    if (from) conditions.push(gte(events.created_at, new Date(from)))
    if (to) conditions.push(lte(events.created_at, new Date(to)))

    const query = db
      .select({
        id: events.id,
        source: events.source,
        conversation_id: events.conversation_id,
        messages: events.messages,
        metadata: events.metadata,
        created_at: events.created_at,
        outcome: classifications.outcome,
        confidence: classifications.confidence,
        reason: classifications.reason,
        signals: classifications.signals,
      })
      .from(events)
      .leftJoin(classifications, eq(events.id, classifications.event_id))
      .orderBy(desc(events.created_at))
      .limit(limit)
      .offset(offset)

    if (conditions.length > 0) {
      query.where(and(...conditions))
    }

    let results = await query

    // Filter by classification fields if specified
    if (outcome) {
      results = results.filter((r) => r.outcome === outcome)
    }
    if (min_confidence !== undefined) {
      results = results.filter((r) => r.confidence && r.confidence >= min_confidence)
    }
    if (max_confidence !== undefined) {
      results = results.filter((r) => r.confidence && r.confidence <= max_confidence)
    }

    // Get total count for pagination
    const countConditions = []
    if (source) countConditions.push(eq(events.source, source))
    if (from) countConditions.push(gte(events.created_at, new Date(from)))
    if (to) countConditions.push(lte(events.created_at, new Date(to)))

    const countQuery = db.select({ count: count() }).from(events)
    if (countConditions.length > 0) {
      countQuery.where(and(...countConditions))
    }

    const [{ count: totalCount }] = await countQuery

    const response: PaginatedResponse<EventWithClassification> = {
      items: results,
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }

    return reply.send(response)
  })

  app.get<{
    Params: { id: string }
  }>('/api/events/:id', async (request, reply) => {
    const { id } = request.params

    const results = await db
      .select({
        id: events.id,
        source: events.source,
        conversation_id: events.conversation_id,
        messages: events.messages,
        metadata: events.metadata,
        created_at: events.created_at,
        outcome: classifications.outcome,
        confidence: classifications.confidence,
        reason: classifications.reason,
        signals: classifications.signals,
      })
      .from(events)
      .leftJoin(classifications, eq(events.id, classifications.event_id))
      .where(eq(events.id, id))
      .limit(1)

    const event = results[0]

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    return reply.send(event)
  })

  app.post<{
    Params: { id: string }
  }>('/api/events/:id/reclassify', async (request, reply) => {
    const { id } = request.params

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1)

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    try {
      const result = await classifyConversation(event.messages as Message[])

      // Delete existing classification if any
      await db.delete(classifications).where(eq(classifications.event_id, id))

      // Insert new classification
      await db.insert(classifications).values({
        event_id: id,
        outcome: result.outcome,
        confidence: result.confidence,
        reason: result.reason,
        signals: result.signals,
      })

      return reply.send({ success: true, classification: result })
    } catch (error) {
      console.error(`Reclassification failed for event ${id}:`, error)
      return reply.status(500).send({ error: 'Classification failed' })
    }
  })

  app.get('/api/stats', async (_request, reply) => {
    const stats = await db
      .select({
        total: count(),
        outcome: classifications.outcome,
        avgConfidence: sql<number>`avg(${classifications.confidence})`,
      })
      .from(events)
      .leftJoin(classifications, eq(events.id, classifications.event_id))
      .groupBy(classifications.outcome)

    const sourceStats = await db
      .select({
        source: events.source,
        total: count(),
      })
      .from(events)
      .groupBy(events.source)

    return reply.send({ outcomeStats: stats, sourceStats })
  })
}
