import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { createDb, type Database } from '@grund/db'
import {
  contacts,
  contactEvents,
  statusEnum,
  channelEnum,
  eventTypeEnum
} from '@grund/db'
import { eq, and, lte, isNull, desc, or } from 'drizzle-orm'
import { createClient } from 'redis'
import type { RedisClientType } from 'redis'

// Validate environment
function validateEnvironment() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  if (!process.env.REDIS_URL) {
    console.error('REDIS_URL is required')
    process.exit(1)
  }
}

// Initialize database and redis connections
let db: Database
let redis: RedisClientType

async function initConnections() {
  validateEnvironment()

  db = createDb(process.env.DATABASE_URL!)

  redis = createClient({
    url: process.env.REDIS_URL,
  })

  await redis.connect()
  console.error('Connected to database and Redis')
}

// Create the MCP server
const server = new Server(
  {
    name: '@grund/mcp-contacts',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'add_contact',
        description: 'Add a new contact to the pipeline',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Contact name' },
            company: { type: 'string', description: 'Company name (optional)' },
            channel: {
              type: 'string',
              enum: ['linkedin', 'email', 'phone', 'referral'],
              description: 'Communication channel',
            },
            status: {
              type: 'string',
              enum: ['cold', 'contacted', 'replied', 'active', 'dead'],
              description: 'Contact status (defaults to cold)',
            },
            notes: { type: 'string', description: 'Initial notes (optional)' },
          },
          required: ['name', 'channel'],
        },
      },
      {
        name: 'update_contact_status',
        description: 'Update contact status and automatically set last_touch_date',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'string', description: 'Contact UUID' },
            status: {
              type: 'string',
              enum: ['cold', 'contacted', 'replied', 'active', 'dead'],
              description: 'New status',
            },
            next_action: { type: 'string', description: 'Next action to take (optional)' },
          },
          required: ['contact_id', 'status'],
        },
      },
      {
        name: 'log_contact_event',
        description: 'Log an event for a contact',
        inputSchema: {
          type: 'object',
          properties: {
            contact_id: { type: 'string', description: 'Contact UUID' },
            event_type: {
              type: 'string',
              enum: ['outreach_sent', 'reply_received', 'follow_up', 'status_change'],
              description: 'Type of event',
            },
            note: { type: 'string', description: 'Event note (optional)' },
          },
          required: ['contact_id', 'event_type'],
        },
      },
      {
        name: 'get_due_followups',
        description: 'Get contacts that need follow-up (contacted/replied 3+ days ago)',
        inputSchema: {
          type: 'object',
          properties: {
            days_threshold: {
              type: 'number',
              description: 'Days since last touch (defaults to 3)',
            },
          },
        },
      },
      {
        name: 'list_contacts',
        description: 'List contacts with optional status filter',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['cold', 'contacted', 'replied', 'active', 'dead'],
              description: 'Filter by status (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (defaults to 50)',
            },
          },
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      case 'add_contact': {
        const result = await db.insert(contacts).values({
          name: args.name as string,
          company: args.company as string | undefined,
          channel: args.channel as 'linkedin' | 'email' | 'phone' | 'referral',
          status: (args.status as 'cold' | 'contacted' | 'replied' | 'active' | 'dead') || 'cold',
          notes: args.notes as string | undefined,
        }).returning()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result[0], null, 2),
            },
          ],
        }
      }

      case 'update_contact_status': {
        const contactId = args.contact_id as string
        const newStatus = args.status as 'cold' | 'contacted' | 'replied' | 'active' | 'dead'
        const nextAction = args.next_action as string | undefined

        // Update contact
        const result = await db.update(contacts)
          .set({
            status: newStatus,
            last_touch_date: new Date().toISOString().split('T')[0],
            next_action: nextAction,
            updated_at: new Date(),
          })
          .where(eq(contacts.id, contactId))
          .returning()

        if (result.length === 0) {
          throw new McpError(ErrorCode.InvalidRequest, `Contact ${contactId} not found`)
        }

        // Log status change event
        await db.insert(contactEvents).values({
          contact_id: contactId,
          event_type: 'status_change',
          note: `Status changed to ${newStatus}`,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result[0], null, 2),
            },
          ],
        }
      }

      case 'log_contact_event': {
        const contactId = args.contact_id as string
        const eventType = args.event_type as 'outreach_sent' | 'reply_received' | 'follow_up' | 'status_change'
        const note = args.note as string | undefined

        const result = await db.insert(contactEvents).values({
          contact_id: contactId,
          event_type: eventType,
          note: note,
        }).returning()

        // Update last_touch_date if it's an interaction event
        if (['outreach_sent', 'reply_received', 'follow_up'].includes(eventType)) {
          await db.update(contacts)
            .set({
              last_touch_date: new Date().toISOString().split('T')[0],
              updated_at: new Date(),
            })
            .where(eq(contacts.id, contactId))
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result[0], null, 2),
            },
          ],
        }
      }

      case 'get_due_followups': {
        const daysThreshold = (args.days_threshold as number) || 3
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

        const result = await db.select()
          .from(contacts)
          .where(
            and(
              lte(contacts.last_touch_date, cutoffDateStr),
              or(
                eq(contacts.status, 'contacted'),
                eq(contacts.status, 'replied')
              )
            )
          )
          .orderBy(contacts.last_touch_date)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: result.length,
                contacts: result,
              }, null, 2),
            },
          ],
        }
      }

      case 'list_contacts': {
        const status = args.status as string | undefined
        const limit = (args.limit as number) || 50

        let query = db.select().from(contacts)

        const baseQuery = db.select().from(contacts)
        const filteredQuery = status
          ? baseQuery.where(eq(contacts.status, status as any))
          : baseQuery

        const result = await filteredQuery
          .orderBy(desc(contacts.updated_at))
          .limit(limit)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: result.length,
                contacts: result,
              }, null, 2),
            },
          ],
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error) {
    if (error instanceof McpError) throw error
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`)
  }
})

// Start the server
async function main() {
  await initConnections()

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP contacts server running')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})