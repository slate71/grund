#!/usr/bin/env bun

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import yaml from 'js-yaml'
import {
  loadPipeline,
  loadNetwork,
  getHighSignalOpportunities,
  getOverdueFollowUps,
  type PipelineData,
  type NetworkData,
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

interface BriefingOutput {
  outreachTarget: string
  commitTarget: string
  pipelineSnapshot: string
  streakStatus: string
  calendarContext: string
  weeklyReview: string
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
    const parsedYaml = yaml.load(frontmatterText) as Record<string, unknown> | undefined

    // Validate and provide defaults for missing fields
    const streak = parsedYaml?.current_streak as Record<string, unknown> | undefined
    const frontmatter: ContextFrontmatter = {
      runway_days: (parsedYaml?.runway_days as number) ?? 0,
      monthly_burn: (parsedYaml?.monthly_burn as number) ?? 0,
      pipeline_count: (parsedYaml?.pipeline_count as number) ?? 0,
      current_streak: {
        commits: (streak?.commits as number) ?? 0,
        outreach: (streak?.outreach as number) ?? 0,
      },
      last_updated: (parsedYaml?.last_updated as string) || new Date().toISOString().split('T')[0],
    }

    // Validate types
    if (
      typeof frontmatter.runway_days !== 'number' ||
      typeof frontmatter.monthly_burn !== 'number' ||
      typeof frontmatter.pipeline_count !== 'number'
    ) {
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
    console.error(
      'Error fetching Linear issues:',
      error instanceof Error ? error.message : 'Unknown error',
    )
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
    console.error(
      'Error fetching calendar events:',
      error instanceof Error ? error.message : 'Unknown error',
    )
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
    (opp) => !opp.stage.startsWith('closed'),
  )
  const highSignalOps = getHighSignalOpportunities(pipeline, 7)
  const overdueContacts = getOverdueFollowUps(network)

  // Count opportunities by stage
  const stageCount: Record<string, number> = {}
  activeOpportunities.forEach((opp) => {
    stageCount[opp.stage] = (stageCount[opp.stage] || 0) + 1
  })

  const isWeeklyReviewDay = dayOfWeek === 'Monday' || dayOfWeek === 'Friday'

  const system = `You are a career operations assistant producing a daily morning briefing for a Staff+ full-stack/systems engineer building reliable agentic systems for complex real-world workflows. 10+ years experience, 5 years leading teams. Deep expertise in agent orchestration, human-in-the-loop systems, and interpretable AI interfaces. The briefing must be actionable, specific, and focused on today's priorities.

Target: Staff+ Engineer at Seed to Series C companies in AI platforms, agentic systems, complex task automation. $275-350K+.

Positioning: Be known as the engineer who makes AI agents reliable and useful for complex real-world tasks.

Daily non-negotiables (must both happen every day):
1. One meaningful commit to Grund (build impressive things)
2. One targeted outreach (email/DM/apply)

Recovery rule: Never skip two days in a row on any action. If a streak is at 0, today is CRITICAL.

Output exactly 6 sections in this format:

## Outreach Target
Who to reach out to today, why now, and a draft message.
Priority order (follow this exactly):
1. Overdue follow-ups
2. Direct applications to high-signal roles
3. Warm intros from network
4. Cold outreach to target companies

Target personas: Founders at AI companies, VCs focused on developer tools, VPs of Engineering at Series A-C, Staff+ engineers at target companies.

## Commit Target
The single most important thing to ship in Grund today.
Pull from Linear priorities if available. Name the specific issue.

## Pipeline Snapshot
Active opportunities by stage, anything needing action, stage changes.
Stages: identified → researched → outreach → conversation → interview → offer → closed.

## Streak Status
Current consecutive days for commits and outreach.
If either streak is at 0, flag as CRITICAL — the recovery rule means today cannot be skipped.
If either streak is at 1, flag as AT RISK.

## Calendar Context
Today's events that affect the plan. Flag conflicts or deep work windows.

## Weekly Review
${
  isWeeklyReviewDay
    ? `Today is ${dayOfWeek} — weekly review items are due:
- Review and update pipeline stages
- Assess network tier transitions
- If meaningful progress was made: write a technical blog post or detailed Twitter/X thread
Content strategy: Show work, not thoughts. GitHub repos and technical blogs only (not LinkedIn).
Thesis threads: Reliable agent architecture, Human-AI collaboration, Complex task automation, Career transparency.`
    : `Not a review day. Only surface if there is something time-sensitive for weekly items (e.g., content opportunity tied to current work).
Content frequency: Only when there is something real to share.`
}

Rules:
- Be direct and specific — no fluff
- Every item must be actionable today
- Flag any missing or stale data
- Outreach drafts should be personal and specific to the recipient
- If Linear or Calendar data is missing, work with what you have`

  // Contacts with upcoming or overdue next_touch, sorted by urgency
  const actionableContacts = network.contacts
    .filter((c) => c.next_touch)
    .sort((a, b) => (a.next_touch || '').localeCompare(b.next_touch || ''))

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
High signal (7+): ${highSignalOps.map((o) => `${o.company} - ${o.role}`).join(', ') || 'None'}

TOP OPPORTUNITIES:
${
  highSignalOps
    .slice(0, 5)
    .map(
      (opp) =>
        `- ${opp.company} (${opp.role}): Stage=${opp.stage}, Signal=${opp.signal_strength}, Last=${opp.last_action.date}${opp.next_action ? `, Next=${opp.next_action.date}: ${opp.next_action.task}` : ''}`,
    )
    .join('\n') || 'No high-signal opportunities'
}

OVERDUE FOLLOW-UPS:
${
  overdueContacts.length > 0
    ? overdueContacts
        .map(
          (c) =>
            `- ${c.name} (${c.company}, ${c.relationship}): Due ${c.next_touch}${c.context ? ` — ${c.context}` : ''}`,
        )
        .join('\n')
    : 'None overdue'
}

UPCOMING TOUCHES:
${
  actionableContacts
    .filter((c) => !overdueContacts.includes(c))
    .slice(0, 5)
    .map(
      (c) =>
        `- ${c.name} (${c.company}, ${c.relationship}): ${c.next_touch}${c.context ? ` — ${c.context}` : ''}`,
    )
    .join('\n') || 'None scheduled'
}

NETWORK CONTEXT:
Total contacts: ${network.contacts.length}
By tier: Target=${network.contacts.filter((c) => c.relationship === 'target').length}, Warm=${network.contacts.filter((c) => c.relationship === 'warm').length}, Active=${network.contacts.filter((c) => c.relationship === 'active').length}, Advocate=${network.contacts.filter((c) => c.relationship === 'advocate').length}

${
  linearIssues
    ? `LINEAR ISSUES:
${linearIssues.map((i) => `- [${i.priority}] ${i.title} (${i.state})${i.dueDate ? ` due ${i.dueDate}` : ''}`).join('\n')}`
    : 'LINEAR: Not available'
}

${
  calendarEvents
    ? `CALENDAR TODAY:
${calendarEvents.map((e) => `- ${e.startTime}-${e.endTime}: ${e.title}${e.description ? ` (${e.description})` : ''}`).join('\n')}`
    : 'CALENDAR: Not available'
}

FULL PIPELINE DATA:
${JSON.stringify(activeOpportunities.slice(0, 5), null, 2)}

FULL CONTEXT:
${context.body}`

  return { system, user }
}

// Call Claude API to generate briefing
async function generateBriefing(
  prompt: { system: string; user: string },
  config: BriefingConfig = DEFAULT_CONFIG,
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
    const sections = text.split('## ').filter((s) => s.trim())
    const briefing: BriefingOutput = {
      outreachTarget: '',
      commitTarget: '',
      pipelineSnapshot: '',
      streakStatus: '',
      calendarContext: '',
      weeklyReview: '',
    }

    // Map sections more robustly
    const sectionMap: Record<string, keyof BriefingOutput> = {
      'Outreach Target': 'outreachTarget',
      'Commit Target': 'commitTarget',
      'Pipeline Snapshot': 'pipelineSnapshot',
      'Streak Status': 'streakStatus',
      'Calendar Context': 'calendarContext',
      'Weekly Review': 'weeklyReview',
    }

    sections.forEach((section) => {
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
    day: 'numeric',
  })

  console.log(`\n${separator}`)
  console.log(`📋 DAILY BRIEFING - ${today}`)
  console.log(separator)

  console.log('\n## 💬 OUTREACH TARGET')
  console.log(briefing.outreachTarget)

  console.log('\n## 💻 COMMIT TARGET')
  console.log(briefing.commitTarget)

  console.log('\n## 📊 PIPELINE SNAPSHOT')
  console.log(briefing.pipelineSnapshot)

  console.log('\n## 🔥 STREAK STATUS')
  console.log(briefing.streakStatus)

  console.log('\n## 📅 CALENDAR CONTEXT')
  console.log(briefing.calendarContext)

  console.log('\n## 📋 WEEKLY REVIEW')
  console.log(briefing.weeklyReview)

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

export {
  parseContext,
  buildPrompt,
  generateBriefing,
  displayBriefing,
  DEFAULT_CONFIG,
  type BriefingConfig,
}
