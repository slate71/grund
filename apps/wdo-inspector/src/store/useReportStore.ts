import { create } from 'zustand'
import type {
  WDOReport,
  Finding,
  FindingCategory,
  FindingSection,
  DiagramElement,
  ConditionsFound,
} from '../types/report'
import { createEmptyReport } from '../types/report'
import { generateFindingLabel, recalculateLabels } from '../utils/findingLabel'
import { saveDraft, loadDraft, clearDraft } from '../hooks/useIndexedDB'

export interface ReportState {
  report: WDOReport
  currentStep: number
  lastSaved: number | null
  isLoading: boolean

  // Navigation
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void

  // Field updates
  updateField: <K extends keyof WDOReport>(key: K, value: WDOReport[K]) => void
  updateOrderedBy: (field: string, value: string) => void
  updatePropertyOwner: (field: string, value: string) => void
  updateReportSentTo: (field: string, value: string) => void
  updateCondition: (field: keyof ConditionsFound, value: boolean) => void
  updateCompany: (field: string, value: string) => void

  // Diagram
  addDiagramElement: (element: DiagramElement) => void
  updateDiagramElement: (id: string, updates: Partial<DiagramElement>) => void
  removeDiagramElement: (id: string) => void
  clearDiagram: () => void

  // Findings
  addFinding: (category: FindingCategory, section: FindingSection) => void
  updateFinding: (id: string, updates: Partial<Finding>) => void
  removeFinding: (id: string) => void

  // Persistence
  loadFromDB: () => Promise<void>
  resetReport: () => Promise<void>
}

function persist(report: WDOReport): number {
  const now = Date.now()
  saveDraft(report)
  return now
}

export const useReportStore = create<ReportState>()((set, _get) => ({
  report: createEmptyReport(),
  currentStep: 0,
  lastSaved: null,
  isLoading: true,

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 5) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

  updateField: (key, value) =>
    set((s) => {
      const report = { ...s.report, [key]: value }
      return { report, lastSaved: persist(report) }
    }),

  updateOrderedBy: (field, value) =>
    set((s) => {
      const report = {
        ...s.report,
        orderedBy: { ...s.report.orderedBy, [field]: value },
      }
      return { report, lastSaved: persist(report) }
    }),

  updatePropertyOwner: (field, value) =>
    set((s) => {
      const report = {
        ...s.report,
        propertyOwner: { ...s.report.propertyOwner, [field]: value },
      }
      return { report, lastSaved: persist(report) }
    }),

  updateReportSentTo: (field, value) =>
    set((s) => {
      const report = {
        ...s.report,
        reportSentTo: { ...s.report.reportSentTo, [field]: value },
      }
      return { report, lastSaved: persist(report) }
    }),

  updateCondition: (field, value) =>
    set((s) => {
      const report = {
        ...s.report,
        conditions: { ...s.report.conditions, [field]: value },
      }
      return { report, lastSaved: persist(report) }
    }),

  updateCompany: (field, value) =>
    set((s) => {
      const report = {
        ...s.report,
        company: { ...s.report.company, [field]: value },
      }
      return { report, lastSaved: persist(report) }
    }),

  addDiagramElement: (element) =>
    set((s) => {
      const report = {
        ...s.report,
        diagramElements: [...s.report.diagramElements, element],
      }
      return { report, lastSaved: persist(report) }
    }),

  updateDiagramElement: (id, updates) =>
    set((s) => {
      const report = {
        ...s.report,
        diagramElements: s.report.diagramElements.map((el) =>
          el.id === id ? { ...el, ...updates } : el,
        ),
      }
      return { report, lastSaved: persist(report) }
    }),

  removeDiagramElement: (id) =>
    set((s) => {
      const report = {
        ...s.report,
        diagramElements: s.report.diagramElements.filter((el) => el.id !== id),
      }
      return { report, lastSaved: persist(report) }
    }),

  clearDiagram: () =>
    set((s) => {
      const report = { ...s.report, diagramElements: [] }
      return { report, lastSaved: persist(report) }
    }),

  addFinding: (category, section) =>
    set((s) => {
      const label = generateFindingLabel(category, s.report.findings)
      const finding: Finding = {
        id: crypto.randomUUID(),
        category,
        section,
        label,
        finding: '',
        recommendation: '',
        location: '',
        cost: 0,
        photos: [],
      }
      const report = {
        ...s.report,
        findings: [...s.report.findings, finding],
      }
      return { report, lastSaved: persist(report) }
    }),

  updateFinding: (id, updates) =>
    set((s) => {
      let findings = s.report.findings.map((f) => (f.id === id ? { ...f, ...updates } : f))
      if (updates.category) {
        findings = recalculateLabels(findings)
      }
      const report = { ...s.report, findings }
      return { report, lastSaved: persist(report) }
    }),

  removeFinding: (id) =>
    set((s) => {
      const findings = recalculateLabels(s.report.findings.filter((f) => f.id !== id))
      const report = { ...s.report, findings }
      return { report, lastSaved: persist(report) }
    }),

  loadFromDB: async () => {
    const saved = await loadDraft()
    if (saved) {
      set({ report: saved, isLoading: false, lastSaved: Date.now() })
    } else {
      set({ isLoading: false })
    }
  },

  resetReport: async () => {
    await clearDraft()
    set({
      report: createEmptyReport(),
      currentStep: 0,
      lastSaved: null,
    })
  },
}))
