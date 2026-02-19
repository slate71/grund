import { useState } from 'react'
import { useReportStore } from '../../store/useReportStore'
import { Input } from '../shared/Input'
import { SignatureCanvas } from '../shared/SignatureCanvas'
import { exportReportJSON } from '../../utils/reportExport'

const CATEGORY_LABELS: Record<string, string> = {
  subterranean: 'Subterranean Termites',
  drywood: 'Drywood Termites',
  fungus: 'Fungus / Dryrot',
  other: 'Other Findings',
}

const SECTION_LABELS: Record<string, string> = {
  section1: 'Section I',
  section2: 'Section II',
  further: 'Further Inspection',
}

export function ReviewSign() {
  const report = useReportStore((s) => s.report)
  const updateField = useReportStore((s) => s.updateField)
  const updateCompany = useReportStore((s) => s.updateCompany)
  const resetReport = useReportStore((s) => s.resetReport)

  const [submitted, setSubmitted] = useState(false)
  const [jsonDump, setJsonDump] = useState('')

  const handleSubmit = () => {
    setJsonDump(exportReportJSON(report))
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-success">
              <path
                d="M22 12L14 20L10 16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text">Report Submitted</h2>
          <p className="text-sm text-text-2 mt-2">
            Report {report.reportNumber} has been saved successfully.
          </p>
        </div>

        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-text-2 mb-2">JSON Export</h3>
          <pre className="text-xs font-mono text-text-2 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
            {jsonDump}
          </pre>
        </div>

        <button
          onClick={() => {
            setSubmitted(false)
            resetReport()
          }}
          className="w-full bg-surface-2 hover:bg-border text-text font-medium py-3 px-4 rounded-lg transition-colors min-h-[44px]"
        >
          Start New Report
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text">Review & Sign</h2>
        <p className="text-sm text-text-2 mt-1">Review all information, then sign and submit</p>
      </div>

      {/* Report Summary */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Report Summary
        </h3>

        <div className="bg-surface rounded-lg border border-border divide-y divide-border">
          {/* Property */}
          <div className="p-4">
            <p className="text-xs text-text-2 mb-1">Property</p>
            <p className="text-sm text-text font-medium">{report.propertyAddress || '—'}</p>
            <p className="text-sm text-text-2">
              {[report.propertyCity, report.propertyState, report.propertyZip]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
          </div>

          {/* Parties */}
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-2 mb-1">Ordered By</p>
              <p className="text-sm text-text">{report.orderedBy.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-2 mb-1">Property Owner</p>
              <p className="text-sm text-text">{report.propertyOwner.name || '—'}</p>
            </div>
          </div>

          {/* Conditions */}
          <div className="p-4">
            <p className="text-xs text-text-2 mb-2">Conditions Found</p>
            <div className="flex flex-wrap gap-2">
              {report.conditions.subterraneanTermites && (
                <span className="text-xs bg-section1/15 text-section1 px-2 py-1 rounded">
                  Subterranean
                </span>
              )}
              {report.conditions.drywoodTermites && (
                <span className="text-xs bg-section1/15 text-section1 px-2 py-1 rounded">
                  Drywood
                </span>
              )}
              {report.conditions.fungusDryrot && (
                <span className="text-xs bg-section2/15 text-section2 px-2 py-1 rounded">
                  Fungus/Dryrot
                </span>
              )}
              {report.conditions.otherFindings && (
                <span className="text-xs bg-surface-2 text-text-2 px-2 py-1 rounded">Other</span>
              )}
              {report.conditions.furtherInspectionNeeded && (
                <span className="text-xs bg-further/15 text-further px-2 py-1 rounded">
                  Further Inspection
                </span>
              )}
              {!report.conditions.subterraneanTermites &&
                !report.conditions.drywoodTermites &&
                !report.conditions.fungusDryrot &&
                !report.conditions.otherFindings &&
                !report.conditions.furtherInspectionNeeded && (
                  <span className="text-xs text-text-2">No conditions checked</span>
                )}
            </div>
          </div>

          {/* Findings */}
          <div className="p-4">
            <p className="text-xs text-text-2 mb-2">Findings ({report.findings.length})</p>
            {report.findings.length === 0 ? (
              <p className="text-sm text-text-2">No findings recorded</p>
            ) : (
              <div className="space-y-2">
                {report.findings.map((f) => (
                  <div key={f.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={[
                        'font-mono text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                        f.section === 'section1'
                          ? 'bg-section1/15 text-section1'
                          : f.section === 'section2'
                            ? 'bg-section2/15 text-section2'
                            : 'bg-further/15 text-further',
                      ].join(' ')}
                    >
                      {f.label}
                    </span>
                    <div className="min-w-0">
                      <span className="text-text">{f.finding || CATEGORY_LABELS[f.category]}</span>
                      <span className="text-text-2 ml-1">— {SECTION_LABELS[f.section]}</span>
                      {f.cost > 0 && (
                        <span className="text-text-2 ml-1 font-mono text-xs">
                          ${f.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cost totals */}
          {report.findings.length > 0 && (
            <div className="p-4">
              <p className="text-xs text-text-2 mb-1">Total Estimated Cost</p>
              <p className="font-mono text-lg font-bold text-text">
                ${report.findings.reduce((sum, f) => sum + f.cost, 0).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Inspector Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Inspector</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Inspector Name"
            value={report.inspectorName}
            onChange={(v) => updateField('inspectorName', v)}
            placeholder="Full name"
            required
          />
          <Input
            label="License Number"
            value={report.licenseNumber}
            onChange={(v) => updateField('licenseNumber', v)}
            placeholder="License #"
            mono
            required
          />
        </div>
      </section>

      {/* Company Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Company</h3>
        <Input
          label="Company Name"
          value={report.company.name}
          onChange={(v) => updateCompany('name', v)}
          placeholder="Company name"
        />
        <Input
          label="Company Address"
          value={report.company.address}
          onChange={(v) => updateCompany('address', v)}
          placeholder="Street address, city, state, zip"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            value={report.company.phone}
            onChange={(v) => updateCompany('phone', v)}
            type="tel"
            placeholder="(555) 123-4567"
          />
          <Input
            label="SPCB Registration"
            value={report.company.spcbRegistration}
            onChange={(v) => updateCompany('spcbRegistration', v)}
            placeholder="PR-####"
            mono
          />
        </div>
      </section>

      {/* Signature */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Signature</h3>
        <SignatureCanvas
          value={report.signatureData}
          onChange={(v) => updateField('signatureData', v)}
        />
      </section>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full bg-success hover:bg-success/90 text-white font-semibold py-4 px-6 rounded-lg transition-colors min-h-[52px] text-base"
      >
        Submit Report
      </button>
    </div>
  )
}
