export type FindingCategory = 'subterranean' | 'drywood' | 'fungus' | 'other'
export type FindingSection = 'section1' | 'section2' | 'further'

export interface Finding {
  id: string
  category: FindingCategory
  section: FindingSection
  label: string
  finding: string
  recommendation: string
  location: string
  cost: number
  photos: string[]
}

export interface ContactInfo {
  name: string
  address: string
  phone: string
  email: string
}

export interface PropertyOwner {
  name: string
  address: string
}

export interface ReportRecipient {
  name: string
  email: string
}

export interface ConditionsFound {
  subterraneanTermites: boolean
  drywoodTermites: boolean
  fungusDryrot: boolean
  otherFindings: boolean
  furtherInspectionNeeded: boolean
}

export type DiagramTool = 'select' | 'rectangle' | 'line' | 'text' | 'pin'

export interface DiagramElement {
  id: string
  type: 'rectangle' | 'line' | 'text' | 'pin'
  x: number
  y: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  text?: string
  pinColor?: string
  findingLabel?: string
}

export interface CompanyInfo {
  name: string
  address: string
  phone: string
  spcbRegistration: string
}

export interface WDOReport {
  // Step 1: Report Info
  reportNumber: string
  inspectionDate: string
  propertyAddress: string
  propertyCity: string
  propertyState: string
  propertyZip: string
  propertyDescription: string

  // Step 2: Parties
  orderedBy: ContactInfo
  propertyOwner: PropertyOwner
  reportSentTo: ReportRecipient

  // Step 3: Conditions
  conditions: ConditionsFound

  // Step 4: Diagram
  diagramElements: DiagramElement[]

  // Step 5: Findings
  findings: Finding[]

  // Step 6: Review & Sign
  inspectorName: string
  licenseNumber: string
  signatureData: string
  company: CompanyInfo
}

export function createEmptyReport(): WDOReport {
  return {
    reportNumber: generateReportNumber(),
    inspectionDate: new Date().toISOString().split('T')[0],
    propertyAddress: '',
    propertyCity: '',
    propertyState: 'CA',
    propertyZip: '',
    propertyDescription: '',
    orderedBy: { name: '', address: '', phone: '', email: '' },
    propertyOwner: { name: '', address: '' },
    reportSentTo: { name: '', email: '' },
    conditions: {
      subterraneanTermites: false,
      drywoodTermites: false,
      fungusDryrot: false,
      otherFindings: false,
      furtherInspectionNeeded: false,
    },
    diagramElements: [],
    findings: [],
    inspectorName: '',
    licenseNumber: '',
    signatureData: '',
    company: { name: '', address: '', phone: '', spcbRegistration: '' },
  }
}

function generateReportNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `WDO-${y}${m}${d}-${seq}`
}
