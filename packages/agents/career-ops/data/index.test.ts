import { describe, it, expect, beforeEach } from 'vitest'
import type { PipelineData, NetworkData } from './index'
import {
  getOpportunitiesByStage,
  getContactsByRelationship,
  getHighSignalOpportunities,
  getOverdueFollowUps,
  createId,
} from './index'

describe('Career Ops Data Helpers', () => {
  let mockPipeline: PipelineData
  let mockNetwork: NetworkData

  beforeEach(() => {
    mockPipeline = {
      opportunities: [
        {
          id: 'company-a-senior',
          company: 'Company A',
          role: 'Senior Engineer',
          comp_range: { low: 200, high: 250 },
          stage: 'interview',
          contacts: [],
          signal_strength: 9,
          source: 'referral',
          last_action: { date: '2026-02-01', summary: 'Had first interview' },
          next_action: { date: '2026-02-10', task: 'Technical interview' },
          notes: 'Great fit',
          url: 'https://example.com',
        },
        {
          id: 'company-b-staff',
          company: 'Company B',
          role: 'Staff Engineer',
          comp_range: { low: 275, high: 325 },
          stage: 'identified',
          contacts: [],
          signal_strength: 5,
          source: 'cold',
          last_action: { date: '2026-02-05', summary: 'Added to pipeline' },
          next_action: null,
          notes: 'Needs research',
          url: '',
        },
        {
          id: 'company-c-principal',
          company: 'Company C',
          role: 'Principal Engineer',
          comp_range: { low: 350, high: 400 },
          stage: 'outreach',
          contacts: ['john-doe'],
          signal_strength: 8,
          source: 'inbound',
          last_action: { date: '2026-02-03', summary: 'Sent intro email' },
          next_action: { date: '2026-02-08', task: 'Follow up' },
          notes: 'AI platform company',
          url: '',
        },
      ],
      metadata: {
        last_updated: '2026-02-05',
        total_opportunities: 3,
        stages: {
          identified: 1,
          researched: 0,
          outreach: 1,
          conversation: 0,
          interview: 1,
          offer: 0,
          'closed-won': 0,
          'closed-lost': 0,
        },
      },
    }

    mockNetwork = {
      contacts: [
        {
          id: 'john-doe',
          name: 'John Doe',
          title: 'VP Engineering',
          company: 'Company C',
          linkedin: 'https://linkedin.com/in/johndoe',
          email: null,
          relationship: 'warm',
          tags: ['vp-eng', 'hiring-manager'],
          last_interaction: null,
          next_touch: '2026-02-01', // Overdue
          context: 'Met at conference',
        },
        {
          id: 'jane-smith',
          name: 'Jane Smith',
          title: 'Founder',
          company: 'Startup X',
          linkedin: null,
          email: 'jane@startup.com',
          relationship: 'advocate',
          tags: ['founder'],
          last_interaction: {
            date: '2026-02-04',
            channel: 'Email',
            summary: 'Offered to help',
          },
          next_touch: '2026-02-15', // Future
          context: 'Former colleague',
        },
        {
          id: 'bob-wilson',
          name: 'Bob Wilson',
          title: 'Recruiter',
          company: 'TechTalent',
          linkedin: 'https://linkedin.com/in/bobwilson',
          email: 'bob@techtalent.com',
          relationship: 'target',
          tags: ['recruiter'],
          last_interaction: null,
          next_touch: null,
          context: 'Specializes in AI roles',
        },
      ],
      metadata: {
        last_updated: '2026-02-05',
        total_contacts: 3,
        relationships: {
          target: 1,
          warm: 1,
          active: 0,
          advocate: 1,
        },
        tags_distribution: {
          founder: 1,
          vc: 0,
          'hiring-manager': 1,
          'vp-eng': 1,
          peer: 0,
          recruiter: 1,
          investor: 0,
        },
      },
    }
  })

  describe('getOpportunitiesByStage', () => {
    it('should filter opportunities by stage', () => {
      const interviewOps = getOpportunitiesByStage(mockPipeline, 'interview')
      expect(interviewOps).toHaveLength(1)
      expect(interviewOps[0].company).toBe('Company A')

      const identifiedOps = getOpportunitiesByStage(mockPipeline, 'identified')
      expect(identifiedOps).toHaveLength(1)
      expect(identifiedOps[0].company).toBe('Company B')
    })

    it('should return empty array for stages with no opportunities', () => {
      const offerOps = getOpportunitiesByStage(mockPipeline, 'offer')
      expect(offerOps).toHaveLength(0)
    })
  })

  describe('getContactsByRelationship', () => {
    it('should filter contacts by relationship tier', () => {
      const warmContacts = getContactsByRelationship(mockNetwork, 'warm')
      expect(warmContacts).toHaveLength(1)
      expect(warmContacts[0].name).toBe('John Doe')

      const advocates = getContactsByRelationship(mockNetwork, 'advocate')
      expect(advocates).toHaveLength(1)
      expect(advocates[0].name).toBe('Jane Smith')
    })

    it('should return empty array for tiers with no contacts', () => {
      const activeContacts = getContactsByRelationship(mockNetwork, 'active')
      expect(activeContacts).toHaveLength(0)
    })
  })

  describe('getHighSignalOpportunities', () => {
    it('should filter and sort by signal strength', () => {
      const highSignal = getHighSignalOpportunities(mockPipeline, 7)
      expect(highSignal).toHaveLength(2)
      expect(highSignal[0].signal_strength).toBe(9) // Company A
      expect(highSignal[1].signal_strength).toBe(8) // Company C
    })

    it('should use default threshold of 7', () => {
      const highSignal = getHighSignalOpportunities(mockPipeline)
      expect(highSignal).toHaveLength(2)
    })

    it('should return empty array when no opportunities meet threshold', () => {
      const veryHighSignal = getHighSignalOpportunities(mockPipeline, 10)
      expect(veryHighSignal).toHaveLength(0)
    })
  })

  describe('getOverdueFollowUps', () => {
    it('should identify overdue contacts', () => {
      const overdue = getOverdueFollowUps(mockNetwork)
      expect(overdue).toHaveLength(1)
      expect(overdue[0].name).toBe('John Doe')
    })

    it('should not include future or null next_touch dates', () => {
      const overdue = getOverdueFollowUps(mockNetwork)
      const names = overdue.map((c) => c.name)
      expect(names).not.toContain('Jane Smith') // Future date
      expect(names).not.toContain('Bob Wilson') // null next_touch
    })
  })

  describe('createId', () => {
    it('should create slugified IDs from parts', () => {
      expect(createId('Company Name', 'Staff Engineer')).toBe('company-name-staff-engineer')

      expect(createId('AI/ML Company', 'Sr. Engineer')).toBe('ai-ml-company-sr-engineer')

      expect(createId(' Extra  Spaces ', ' Between ')).toBe('extra-spaces-between')
    })

    it('should handle special characters', () => {
      expect(createId('Company (USA)', 'Engineer #1')).toBe('company-usa-engineer-1')
    })

    it('should handle single part', () => {
      expect(createId('SinglePart')).toBe('singlepart')
    })
  })
})
