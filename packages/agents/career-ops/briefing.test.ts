import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildPrompt, displayBriefing } from './briefing'
import type { PipelineData, NetworkData } from './data/index'

describe('Briefing Engine', () => {
  const mockContext = {
    frontmatter: {
      runway_days: 90,
      monthly_burn: 5000,
      pipeline_count: 12,
      current_streak: {
        commits: 5,
        outreach: 3,
      },
      last_updated: '2026-02-05',
    },
    body: `# Career Ops Agent Context

## Identity & Positioning

**Core Identity**
- Building reliable agentic systems for complex real-world workflows
- Full-stack engineer with over 10 years of experience`,
  }

  const mockPipelineData: PipelineData = {
    opportunities: [
      {
        id: 'acme-senior-engineer',
        company: 'Acme Corp',
        role: 'Senior Engineer',
        comp_range: { low: 180, high: 220 },
        stage: 'conversation',
        contacts: ['john-smith'],
        signal_strength: 8,
        source: 'referral',
        last_action: { date: '2026-02-04', summary: 'Initial call' },
        next_action: { date: '2026-02-08', task: 'Follow up on technical discussion' },
        notes: 'Good cultural fit',
        url: 'https://acme.com/careers',
      },
      {
        id: 'techco-staff-engineer',
        company: 'TechCo',
        role: 'Staff Engineer',
        comp_range: { low: 250, high: 300 },
        stage: 'identified',
        contacts: [],
        signal_strength: 6,
        source: 'cold',
        last_action: { date: '2026-02-01' },
        next_action: null,
        notes: 'Interesting AI focus',
        url: 'https://techco.com/jobs',
      },
    ],
    metadata: {
      last_updated: '2026-02-05',
      total_opportunities: 2,
      stages: {
        identified: 1,
        researched: 0,
        outreach: 0,
        conversation: 1,
        interview: 0,
        offer: 0,
        'closed-won': 0,
        'closed-lost': 0,
      },
    },
  }

  const mockNetworkData: NetworkData = {
    contacts: [
      {
        id: 'john-smith',
        name: 'John Smith',
        title: 'VP Engineering',
        company: 'Acme Corp',
        linkedin: 'https://linkedin.com/in/johnsmith',
        email: 'john@acme.com',
        relationship: 'warm',
        tags: ['hiring-manager', 'vp-eng'],
        last_interaction: {
          date: '2026-02-04',
          channel: 'email',
          summary: 'Discussed role and team',
        },
        next_touch: '2026-02-03', // Overdue
        context: 'Met at conference last year',
      },
      {
        id: 'jane-doe',
        name: 'Jane Doe',
        title: 'Founder',
        company: 'StartupCo',
        linkedin: null,
        email: null,
        relationship: 'target',
        tags: ['founder'],
        last_interaction: null,
        next_touch: null,
        context: 'Building AI agents platform',
      },
    ],
    metadata: {
      last_updated: '2026-02-05',
      total_contacts: 2,
      relationships: {
        target: 1,
        warm: 1,
        active: 0,
        advocate: 0,
      },
      tags_distribution: {
        founder: 1,
        vc: 0,
        'hiring-manager': 1,
        'vp-eng': 1,
        peer: 0,
        recruiter: 0,
        investor: 0,
      },
    },
  }

  describe('buildPrompt', () => {
    it('should build system and user prompts correctly', () => {
      const { system, user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        null,
        null
      )

      // Check system prompt
      expect(system).toContain('career operations assistant')
      expect(system).toContain('## Outreach Target')
      expect(system).toContain('## GitHub Target')
      expect(system).toContain('## Commit Target')
      expect(system).toContain('## Pipeline Snapshot')
      expect(system).toContain('## Streak Status')
      expect(system).toContain('## Calendar Context')

      // Check user prompt
      expect(user).toContain('Runway: 90 days')
      expect(user).toContain('Monthly burn: $5000')
      expect(user).toContain('Commit streak: 5 days')
      expect(user).toContain('Active opportunities: 2')
      expect(user).toContain('Acme Corp')
      expect(user).toContain('John Smith')
    })

    it('should handle missing Linear and Calendar data', () => {
      const { user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        null,
        null
      )

      expect(user).toContain('LINEAR: Not available')
      expect(user).toContain('CALENDAR: Not available')
    })

    it('should include Linear issues when available', () => {
      const linearIssues = [
        {
          id: 'TOG-364',
          title: 'Build briefing engine',
          state: 'in_progress',
          priority: 'high',
          dueDate: '2026-02-07',
        },
      ]

      const { user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        linearIssues,
        null
      )

      expect(user).toContain('LINEAR ISSUES:')
      expect(user).toContain('[high] Build briefing engine (in_progress)')
    })

    it('should include calendar events when available', () => {
      const calendarEvents = [
        {
          title: 'Team standup',
          startTime: '10:00 AM',
          endTime: '10:30 AM',
          description: 'Daily sync',
        },
      ]

      const { user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        null,
        calendarEvents
      )

      expect(user).toContain('CALENDAR TODAY:')
      expect(user).toContain('10:00 AM: Team standup')
    })

    it('should identify overdue follow-ups', () => {
      const { user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        null,
        null
      )

      expect(user).toContain('OVERDUE FOLLOW-UPS:')
      expect(user).toContain('John Smith (Acme Corp): Due 2026-02-03')
    })

    it('should include high-signal opportunities', () => {
      const { user } = buildPrompt(
        mockContext,
        mockPipelineData,
        mockNetworkData,
        null,
        null
      )

      expect(user).toContain('High signal (7+): Acme Corp - Senior Engineer')
      expect(user).toContain('Stage=conversation, Signal=8')
    })

    it('should handle empty pipeline and network data', () => {
      const emptyPipeline: PipelineData = {
        opportunities: [],
        metadata: {
          last_updated: '2026-02-05',
          total_opportunities: 0,
          stages: {
            identified: 0,
            researched: 0,
            outreach: 0,
            conversation: 0,
            interview: 0,
            offer: 0,
            'closed-won': 0,
            'closed-lost': 0,
          },
        },
      }

      const emptyNetwork: NetworkData = {
        contacts: [],
        metadata: {
          last_updated: '2026-02-05',
          total_contacts: 0,
          relationships: {
            target: 0,
            warm: 0,
            active: 0,
            advocate: 0,
          },
          tags_distribution: {
            founder: 0,
            vc: 0,
            'hiring-manager': 0,
            'vp-eng': 0,
            peer: 0,
            recruiter: 0,
            investor: 0,
          },
        },
      }

      const { user } = buildPrompt(
        mockContext,
        emptyPipeline,
        emptyNetwork,
        null,
        null
      )

      expect(user).toContain('Active opportunities: 0')
      expect(user).toContain('High signal (7+): None')
      expect(user).toContain('None overdue')
      expect(user).toContain('Total contacts: 0')
    })
  })

  describe('displayBriefing', () => {
    // Capture console output during tests
    let consoleOutput: string[] = []
    const originalLog = console.log

    beforeEach(() => {
      consoleOutput = []
      console.log = (...args: any[]) => {
        consoleOutput.push(args.map(arg => String(arg)).join(' '))
      }
    })

    afterEach(() => {
      console.log = originalLog
    })

    it('should format and display briefing correctly', () => {
      const briefing = {
        outreachTarget: 'Email John Smith about the Staff Engineer role',
        githubTarget: 'Ship agent orchestration patterns module',
        commitTarget: 'TOG-364 implementation',
        pipelineSnapshot: '2 active opportunities',
        streakStatus: '5 days commits, 3 days outreach',
        calendarContext: 'No conflicts',
      }

      displayBriefing(briefing)

      const output = consoleOutput.join('\n')
      expect(output).toContain('DAILY BRIEFING')
      expect(output).toContain('📧 OUTREACH TARGET')
      expect(output).toContain('Email John Smith about the Staff Engineer role')
      expect(output).toContain('🔨 GITHUB TARGET')
      expect(output).toContain('Ship agent orchestration patterns module')
      expect(output).toContain('💻 COMMIT TARGET')
      expect(output).toContain('TOG-364 implementation')
      expect(output).toContain('🔥 STREAK STATUS')
      expect(output).toContain('5 days commits, 3 days outreach')
    })

    it('should handle empty briefing sections gracefully', () => {
      const briefing = {
        outreachTarget: '',
        githubTarget: '',
        commitTarget: '',
        pipelineSnapshot: '',
        streakStatus: '',
        calendarContext: '',
      }

      displayBriefing(briefing)

      const output = consoleOutput.join('\n')
      expect(output).toContain('DAILY BRIEFING')
      // Should still display all section headers even if empty
      expect(output).toContain('📧 OUTREACH TARGET')
      expect(output).toContain('🔨 GITHUB TARGET')
      expect(output).toContain('💻 COMMIT TARGET')
    })
  })
})