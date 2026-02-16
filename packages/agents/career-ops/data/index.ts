import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Pipeline Types
export type PipelineStage =
  | 'identified'
  | 'researched'
  | 'outreach'
  | 'conversation'
  | 'interview'
  | 'offer'
  | 'closed-won'
  | 'closed-lost'

export type OpportunitySource = 'inbound' | 'referral' | 'cold' | 'recruiter'

export interface CompRange {
  low: number // in thousands
  high: number // in thousands
}

export interface Action {
  date: string // ISO string
  summary?: string
  task?: string
}

export interface Opportunity {
  id: string // slugified company-role
  company: string
  role: string
  comp_range: CompRange
  stage: PipelineStage
  contacts: string[] // references to network.json ids
  signal_strength: number // 1-10
  source: OpportunitySource
  last_action: Action
  next_action: Action | null
  notes: string
  url: string
}

export interface PipelineData {
  opportunities: Opportunity[]
  metadata: {
    last_updated: string
    total_opportunities: number
    stages: Record<PipelineStage, number>
  }
}

// Network Types
export type RelationshipTier = 'target' | 'warm' | 'active' | 'advocate'

export type ContactTag =
  | 'founder'
  | 'vc'
  | 'hiring-manager'
  | 'vp-eng'
  | 'peer'
  | 'recruiter'
  | 'investor'

export interface Interaction {
  date: string // ISO string
  channel: string
  summary: string
}

export interface Contact {
  id: string // slugified name
  name: string
  title: string
  company: string
  linkedin: string | null
  email: string | null
  relationship: RelationshipTier
  tags: ContactTag[]
  last_interaction: Interaction | null
  next_touch: string | null // ISO string
  context: string
}

export interface NetworkData {
  contacts: Contact[]
  metadata: {
    last_updated: string
    total_contacts: number
    relationships: Record<RelationshipTier, number>
    tags_distribution: Record<ContactTag, number>
  }
}

// Helper Functions
export function loadPipeline(): PipelineData {
  const filePath = join(__dirname, 'pipeline.json')
  const data = readFileSync(filePath, 'utf-8')
  return JSON.parse(data) as PipelineData
}

export function loadNetwork(): NetworkData {
  const filePath = join(__dirname, 'network.json')
  const data = readFileSync(filePath, 'utf-8')
  return JSON.parse(data) as NetworkData
}

export function savePipeline(data: PipelineData): void {
  const filePath = join(__dirname, 'pipeline.json')
  writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function saveNetwork(data: NetworkData): void {
  const filePath = join(__dirname, 'network.json')
  writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Query helpers
export function getOpportunitiesByStage(
  pipeline: PipelineData,
  stage: PipelineStage,
): Opportunity[] {
  return pipeline.opportunities.filter((opp) => opp.stage === stage)
}

export function getContactsByRelationship(
  network: NetworkData,
  relationship: RelationshipTier,
): Contact[] {
  return network.contacts.filter((contact) => contact.relationship === relationship)
}

export function getHighSignalOpportunities(pipeline: PipelineData, threshold = 7): Opportunity[] {
  return pipeline.opportunities
    .filter((opp) => opp.signal_strength >= threshold)
    .sort((a, b) => b.signal_strength - a.signal_strength)
}

export function getOverdueFollowUps(network: NetworkData): Contact[] {
  const now = new Date().toISOString()
  return network.contacts.filter((contact) => contact.next_touch && contact.next_touch < now)
}

// Utility to create slugified IDs
export function createId(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
