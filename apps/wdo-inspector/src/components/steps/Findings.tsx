import { useState } from 'react'
import { useReportStore, type ReportState } from '../../store/useReportStore'
import { FindingCard } from '../findings/FindingCard'
import { CostSummary } from '../findings/CostSummary'
import type { Finding, FindingCategory, FindingSection } from '../../types/report'

export function Findings() {
  const findings = useReportStore((s: ReportState) => s.report.findings)
  const addFinding = useReportStore((s: ReportState) => s.addFinding)
  const updateFinding = useReportStore((s: ReportState) => s.updateFinding)
  const removeFinding = useReportStore((s: ReportState) => s.removeFinding)

  const [newCategory, setNewCategory] = useState<FindingCategory>('subterranean')
  const [newSection, setNewSection] = useState<FindingSection>('section1')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text">Findings & Recommendations</h2>
        <p className="text-sm text-text-2 mt-1">
          Document each finding with category, section, and recommendation
        </p>
      </div>

      {/* Add Finding */}
      <div className="bg-surface-2 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as FindingCategory)}
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent min-h-[44px]"
          >
            <option value="subterranean">1 — Subterranean Termites</option>
            <option value="drywood">2 — Drywood Termites</option>
            <option value="fungus">3 — Fungus / Dryrot</option>
            <option value="other">4 — Other Findings</option>
          </select>
          <select
            value={newSection}
            onChange={(e) => setNewSection(e.target.value as FindingSection)}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent min-h-[44px]"
          >
            <option value="section1">Sec I</option>
            <option value="section2">Sec II</option>
            <option value="further">Further</option>
          </select>
        </div>
        <button
          onClick={() => addFinding(newCategory, newSection)}
          className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 px-4 rounded-lg transition-colors min-h-[44px]"
        >
          + Add Finding
        </button>
      </div>

      {/* Findings List */}
      {findings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-2 text-sm">No findings yet</p>
          <p className="text-text-2/60 text-xs mt-1">Add findings using the controls above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {findings.map((f: Finding) => (
            <FindingCard
              key={f.id}
              finding={f}
              onUpdate={(updates) => updateFinding(f.id, updates)}
              onRemove={() => removeFinding(f.id)}
            />
          ))}
        </div>
      )}

      {/* Cost Summary */}
      {findings.length > 0 && <CostSummary findings={findings} />}
    </div>
  )
}
