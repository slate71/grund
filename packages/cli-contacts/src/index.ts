#!/usr/bin/env node
import { Command } from 'commander'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create MCP client
async function createMCPClient() {
  const serverPath = path.resolve(__dirname, '../../mcp-contacts/dist/index.js')

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/grund',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  })

  const client = new Client({
    name: 'grund-contact-cli',
    version: '0.0.1',
  }, {
    capabilities: {}
  })

  await client.connect(transport)
  return client
}

// Helper to call MCP tool
async function callTool(client: Client, toolName: string, args: any) {
  const result = await client.callTool({ name: toolName, arguments: args })

  if (result && 'content' in result && Array.isArray(result.content) && result.content.length > 0) {
    const content = result.content[0]
    if (content && typeof content === 'object' && 'type' in content && content.type === 'text' && 'text' in content) {
      return JSON.parse(content.text as string)
    }
  }

  return null
}

// Create the CLI program
const program = new Command()

program
  .name('grund contact')
  .description('Manage contact pipeline for Grund')
  .version('0.0.1')

// Add contact command
program
  .command('add')
  .description('Add a new contact')
  .requiredOption('-n, --name <name>', 'Contact name')
  .option('-c, --company <company>', 'Company name')
  .requiredOption('-ch, --channel <channel>', 'Channel: linkedin, email, phone, referral')
  .option('-s, --status <status>', 'Status: cold, contacted, replied, active, dead', 'cold')
  .option('--notes <notes>', 'Initial notes')
  .action(async (options) => {
    try {
      const client = await createMCPClient()
      const result = await callTool(client, 'add_contact', options)
      console.log('Contact added:', result)
      await client.close()
    } catch (error) {
      console.error('Error adding contact:', error)
      process.exit(1)
    }
  })

// Update status command
program
  .command('status <id> <status>')
  .description('Update contact status')
  .option('-a, --action <action>', 'Next action to take')
  .action(async (id, status, options) => {
    try {
      const client = await createMCPClient()
      const result = await callTool(client, 'update_contact_status', {
        contact_id: id,
        status: status,
        next_action: options.action,
      })
      console.log('Status updated:', result)
      await client.close()
    } catch (error) {
      console.error('Error updating status:', error)
      process.exit(1)
    }
  })

// Log event command
program
  .command('log <id> <event_type>')
  .description('Log a contact event (outreach_sent, reply_received, follow_up, status_change)')
  .option('-n, --note <note>', 'Event note')
  .action(async (id, eventType, options) => {
    try {
      const client = await createMCPClient()
      const result = await callTool(client, 'log_contact_event', {
        contact_id: id,
        event_type: eventType,
        note: options.note,
      })
      console.log('Event logged:', result)
      await client.close()
    } catch (error) {
      console.error('Error logging event:', error)
      process.exit(1)
    }
  })

// List contacts command
program
  .command('list')
  .description('List contacts')
  .option('-s, --status <status>', 'Filter by status')
  .option('-l, --limit <limit>', 'Maximum results', '50')
  .option('--due', 'Show contacts due for followup')
  .action(async (options) => {
    try {
      const client = await createMCPClient()

      if (options.due) {
        const result = await callTool(client, 'get_due_followups', {})
        console.log(`${result.count} contacts due for follow-up:`)
        result.contacts.forEach((contact: any) => {
          console.log(`  ${contact.name} (${contact.company || 'N/A'}) - Last: ${contact.last_touch_date}`)
        })
      } else {
        const result = await callTool(client, 'list_contacts', {
          status: options.status,
          limit: parseInt(options.limit),
        })
        console.log(`${result.count} contacts:`)
        result.contacts.forEach((contact: any) => {
          console.log(`  ${contact.name} (${contact.company || 'N/A'}) - ${contact.status} - ${contact.channel}`)
        })
      }

      await client.close()
    } catch (error) {
      console.error('Error listing contacts:', error)
      process.exit(1)
    }
  })

program.parse(process.argv)