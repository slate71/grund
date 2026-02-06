#!/usr/bin/env bun

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import yaml from 'js-yaml'
import {
  loadPipeline,
  loadNetwork,
  getOpportunitiesByStage,
  getHighSignalOpportunities,
  getOverdueFollowUps,
  type PipelineData,
  type NetworkData,
  type Contact,
  type Opportunity,
} from './data/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Types for context and briefing
interface ContextFrontmatter {
  runway_days: number
  monthly_burn: number
  pipeline_count: number
  current_streak: {
    commits: number
    outreach: number
  }
  last_updated: string
}

interface Context {
  frontmatter: ContextFrontmatter
  body: string
}

interface LinearIssue {
  id: string
  title: string
  state: string
  priority: string
  dueDate?: string
}

interface CalendarEvent {
  title: string
  startTime: string
  endTime: string
  description?: string
}

interface BriefingSection {
  title: string
  content: string
}

interface BriefingOutput {
  dmTarget: string
  postAngle: string
  commitTarget: string
  pipelineSnapshot: string
  streakStatus: string
  calendarContext: string
}

interface BriefingConfig {
  anthropicApiKey?: string
  modelName: string
  maxTokens: number
  contextPath: string
}

const DEFAULT_CONFIG: BriefingConfig = {
  modelName: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
  contextPath: process.env.CONTEXT_PATH || 'CONTEXT.md',
}

// Parse YAML frontmatter from CONTEXT.md
function parseContext(config: BriefingConfig = DEFAULT_CONFIG): Context {
  try {
    const contextPath = join(__dirname, config.contextPath)
    const content = readFileSync(contextPath, 'utf-8')

    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)

    if (!match) {
      throw new Error('Could not parse CONTEXT.md frontmatter - missing YAML delimiters')
    }

    const [, frontmatterText, body] = match

    // Parse YAML using js-yaml
    const parsedYaml = yaml.load(frontmatterText) as any

    // Validate and provide defaults for missing fields
    const frontmatter: ContextFrontmatter = {
      runway_days: parsedYaml?.runway_days ?? 0,
      monthly_burn: parsedYaml?.monthly_burn ?? 0,
      pipeline_count: parsedYaml?.pipeline_count ?? 0,
      current_streak: {
        commits: parsedYaml?.current_streak?.commits ?? 0,
        outreach: parsedYaml?.current_streak?.outreach ?? 0,
      },
      last_updated: parsedYaml?.last_updated || new Date().toISOString().split('T')[0],
    }

    // Validate types
    if (typeof frontmatter.runway_days !== 'number' ||
        typeof frontmatter.monthly_burn !== 'number' ||
        typeof frontmatter.pipeline_count !== 'number') {
      console.warn('Warning: Some frontmatter fields have invalid types, using defaults')
    }

    return { frontmatter, body }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse context file: ${error.message}`)
    }
    throw error
  }
}

// Mock Linear integration - gracefully degrade if not available
async function fetchLinearIssues(): Promise<LinearIssue[] | null> {
  try {
    // TODO: Implement actual Linear MCP/API integration when available
    console.log('Linear integration not available - continuing without Linear data')
    return null
  } catch (error) {
    console.error('Error fetching Linear issues:', error instanceof Error ? error.message : 'Unknown error')
    console.log('Continuing without Linear data')
    return null
  }
}

// Mock Calendar integration - gracefully degrade if not available
async function fetchCalendarEvents(): Promise<CalendarEvent[] | null> {
  try {
    // TODO: Implement actual Google Calendar MCP/API integration when available
    console.log('Calendar integration not available - continuing without calendar data')
    return null
  } catch (error) {
    console.error('Error fetching calendar events:', error instanceof Error ? error.message : 'Unknown error')
    console.log('Continuing without calendar data')
    return null
  }
}

// Build the Claude prompt with all context
function buildPrompt(
  context: Context,
  pipeline: PipelineData,
  network: NetworkData,
  linearIssues: LinearIssue[] | null,
  calendarEvents: CalendarEvent[] | null,
): { system: string; user: string } {
  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toISOString().split('T')[0]

  // Get relevant pipeline data
  const activeOpportunities = pipeline.opportunities.filter(
    opp => !opp.stage.startsWith('closed')
  )
  const highSignalOps = getHighSignalOpportunities(pipeline, 7)
  const overdueContacts = getOverdueFollowUps(network)

  // Count opportunities by stage
  const stageCount: Record<string, number> = {}
  activeOpportunities.forEach(opp => {
    stageCount[opp.stage] = (stageCount[opp.stage] || 0) + 1
  })

  const system = `You are a career operations assistant producing a daily morning briefing for a senior engineer seeking their next role. The briefing must be actionable, specific, and focused on today's priorities.

Output exactly 6 sections in this format:

## DM Target
Who to reach out to today, why now, and a draft message.
Priority: overdue follow-ups > warm leads going cold > new high-signal targets.

## Post Angle
A specific content topic tied to thesis threads from the context.
Factor in what's due for a revisit and what connects to current work.

## Commit Target
The single most important thing to ship in Grund today.
Pull from Linear priorities if available. Name the specific issue.

## Pipeline Snapshot
Active opportunities by stage, anything needing action, stage changes.

## Streak Status
Current consecutive days for commits and outreach.
Flag if at risk. Enforce "never skip two."

## Calendar Context
Today's events that affect the plan. Flag conflicts or deep work windows.

Rules:
- Be direct and specific - no fluff
- Every item must be actionable today
- Flag any missing or stale data
- DM drafts should be personal and specific
- Post angles should demonstrate technical depth
- If Linear or Calendar data is missing, work with what you have`

  const user = `Today: ${dayOfWeek}, ${dateStr}

CONTEXT METRICS:
- Runway: ${context.frontmatter.runway_days} days
- Monthly burn: $${context.frontmatter.monthly_burn}
- Pipeline count: ${context.frontmatter.pipeline_count}
- Commit streak: ${context.frontmatter.current_streak.commits} days
- Outreach streak: ${context.frontmatter.current_streak.outreach} days
- Last updated: ${context.frontmatter.last_updated}

PIPELINE SNAPSHOT:
Active opportunities: ${activeOpportunities.length}
By stage: ${JSON.stringify(stageCount, null, 2)}
High signal (7+): ${highSignalOps.map(o => `${o.company} - ${o.role}`).join(', ') || 'None'}

TOP OPPORTUNITIES:
${highSignalOps.slice(0, 3).map(opp =>
  `- ${opp.company} (${opp.role}): Stage=${opp.stage}, Signal=${opp.signal_strength}, Last=${opp.last_action.date}`
).join('\n') || 'No high-signal opportunities'}

OVERDUE FOLLOW-UPS:
${overdueContacts.length > 0
  ? overdueContacts.map(c => `- ${c.name} (${c.company}): Due ${c.next_touch}`).join('\n')
  : 'None overdue'}

NETWORK CONTEXT:
Total contacts: ${network.contacts.length}
Warm contacts: ${network.contacts.filter(c => c.relationship === 'warm').length}
Active conversations: ${network.contacts.filter(c => c.relationship === 'active').length}
Advocates: ${network.contacts.filter(c => c.relationship === 'advocate').length}

${linearIssues ? `LINEAR ISSUES:
${linearIssues.map(i => `- [${i.priority}] ${i.title} (${i.state})`).join('\n')}` : 'LINEAR: Not available'}

${calendarEvents ? `CALENDAR TODAY:
${calendarEvents.map(e => `- ${e.startTime}: ${e.title}`).join('\n')}` : 'CALENDAR: Not available'}

FULL PIPELINE DATA:
${JSON.stringify(activeOpportunities.slice(0, 5), null, 2)}

IDENTITY & POSITIONING (from context):
${context.body.split('\n').slice(12, 30).join('\n')}`

  return { system, user }
}

// Call Claude API to generate briefing
async function generateBriefing(
  prompt: { system: string; user: string },
  config: BriefingConfig = DEFAULT_CONFIG
): Promise<BriefingOutput> {
  const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable')
    console.error('Set it with: export ANTHROPIC_API_KEY="your-api-key"')
    process.exit(1)
  }

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: config.modelName,
      max_tokens: config.maxTokens,
    messages: [
      {
        role: 'user',
        content: prompt.user,
      },
    ],
    system: prompt.system,
  })

    // Validate response structure
    if (!response.content?.[0] || response.content[0].type !== 'text') {
      throw new Error('Invalid response format from Claude API')
    }

    const text = response.content[0].text

    // Parse sections from the response with better error handling
    const sections = text.split('## ').filter(s => s.trim())
    const briefing: BriefingOutput = {
    dmTarget: '',
    postAngle: '',
    commitTarget: '',
    pipelineSnapshot: '',
    streakStatus: '',
    calendarContext: '',
  }

    // Map sections more robustly
    const sectionMap: Record<string, keyof BriefingOutput> = {
      'DM Target': 'dmTarget',
      'Post Angle': 'postAngle',
      'Commit Target': 'commitTarget',
      'Pipeline Snapshot': 'pipelineSnapshot',
      'Streak Status': 'streakStatus',
      'Calendar Context': 'calendarContext',
    }

    sections.forEach(section => {
      const [title, ...content] = section.split('\n')
      const contentText = content.join('\n').trim()

      for (const [key, field] of Object.entries(sectionMap)) {
        if (title.includes(key)) {
          briefing[field] = contentText
          break
        }
      }
    })

    // Validate all required sections are present
    const missingSections = Object.entries(briefing)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key)

    if (missingSections.length > 0) {
      console.warn(`Warning: Missing sections in briefing: ${missingSections.join(', ')}`)
    }

    return briefing
  } catch (error) {
    if (error instanceof Error) {
      // Don't expose API key in error messages
      const sanitizedError = error.message.replace(/sk-[A-Za-z0-9]+/g, 'sk-***')
      throw new Error(`Failed to generate briefing: ${sanitizedError}`)
    }
    throw new Error('Failed to generate briefing: Unknown error')
  }
}

// Format and display the briefing
function displayBriefing(briefing: BriefingOutput): void {
  const separator = '─'.repeat(60)
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  console.log(`\n${separator}`)
  console.log(`📋 DAILY BRIEFING - ${today}`)
  console.log(separator)

  console.log('\n## 💬 DM TARGET')
  console.log(briefing.dmTarget)

  console.log('\n## 📝 POST ANGLE')
  console.log(briefing.postAngle)

  console.log('\n## 💻 COMMIT TARGET')
  console.log(briefing.commitTarget)

  console.log('\n## 📊 PIPELINE SNAPSHOT')
  console.log(briefing.pipelineSnapshot)

  console.log('\n## 🔥 STREAK STATUS')
  console.log(briefing.streakStatus)

  console.log('\n## 📅 CALENDAR CONTEXT')
  console.log(briefing.calendarContext)

  console.log(`\n${separator}\n`)
}

// Main execution
async function main(): Promise<void> {
  try {
    const isDemoMode = process.argv.includes('--demo')

    console.log('Generating daily briefing...\n')

    // 1. Gather context
    console.log('📖 Reading context...')
    const context = parseContext()

    console.log('📊 Loading pipeline...')
    const pipeline = loadPipeline()

    console.log('🤝 Loading network...')
    const network = loadNetwork()

    // 2. Get optional integrations
    console.log('📋 Fetching Linear issues...')
    const linearIssues = await fetchLinearIssues()

    console.log('📅 Fetching calendar events...')
    const calendarEvents = await fetchCalendarEvents()

    // 3. Build prompt
    console.log('🔨 Building prompt...')
    const prompt = buildPrompt(context, pipeline, network, linearIssues, calendarEvents)

    if (isDemoMode) {
      console.log('\n' + '─'.repeat(60))
      console.log('DEMO MODE - Showing prompt without calling API')
      console.log('─'.repeat(60))
      console.log('\nSYSTEM PROMPT:')
      console.log(prompt.system.slice(0, 500) + '...')
      console.log('\nUSER PROMPT:')
      console.log(prompt.user.slice(0, 800) + '...')
      console.log('\n' + '─'.repeat(60))
      console.log('To run with API, set ANTHROPIC_API_KEY environment variable')
      console.log('─'.repeat(60) + '\n')
      return
    }

    // 4. Call Claude
    console.log('🤖 Calling Claude API...')
    const briefing = await generateBriefing(prompt, DEFAULT_CONFIG)

    // 5. Display briefing
    displayBriefing(briefing)

  } catch (error) {
    console.error('Error generating briefing:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { parseContext, buildPrompt, generateBriefing, displayBriefing, DEFAULT_CONFIG, type BriefingConfig }