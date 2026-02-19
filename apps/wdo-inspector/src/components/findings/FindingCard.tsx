import type { Finding, FindingCategory, FindingSection } from '../../types/report'
import { Input } from '../shared/Input'

interface FindingCardProps {
  finding: Finding
  onUpdate: (updates: Partial<Finding>) => void
  onRemove: () => void
}

const CATEGORY_OPTIONS: { value: FindingCategory; label: string }[] = [
  { value: 'subterranean', label: '1 — Subterranean' },
  { value: 'drywood', label: '2 — Drywood' },
  { value: 'fungus', label: '3 — Fungus' },
  { value: 'other', label: '4 — Other' },
]

const SECTION_OPTIONS: { value: FindingSection; label: string; color: string }[] = [
  { value: 'section1', label: 'Section I', color: 'section1' },
  { value: 'section2', label: 'Section II', color: 'section2' },
  { value: 'further', label: 'Further', color: 'further' },
]

export function FindingCard({ finding, onUpdate, onRemove }: FindingCardProps) {
  const borderColor =
    finding.section === 'section1'
      ? 'border-l-section1'
      : finding.section === 'section2'
        ? 'border-l-section2'
        : 'border-l-further'

  const labelBg =
    finding.section === 'section1'
      ? 'bg-section1/20 text-section1'
      : finding.section === 'section2'
        ? 'bg-section2/20 text-section2'
        : 'bg-further/20 text-further'

  return (
    <div
      className={`bg-surface rounded-lg border border-border border-l-4 ${borderColor} p-4 space-y-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${labelBg}`}>
            {finding.label}
          </span>
          <select
            value={finding.category}
            onChange={(e) => onUpdate({ category: e.target.value as FindingCategory })}
            className="bg-surface-2 border border-border rounded-md px-2 py-1 text-sm text-text focus:outline-none focus:border-accent"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="text-text-2 hover:text-section1 transition-colors p-1"
          title="Remove finding"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Section radio buttons */}
      <div className="flex gap-2">
        {SECTION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={[
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors min-h-[44px]',
              finding.section === opt.value
                ? opt.color === 'section1'
                  ? 'bg-section1/15 text-section1 ring-1 ring-section1/30'
                  : opt.color === 'section2'
                    ? 'bg-section2/15 text-section2 ring-1 ring-section2/30'
                    : 'bg-further/15 text-further ring-1 ring-further/30'
                : 'bg-surface-2 text-text-2',
            ].join(' ')}
          >
            <input
              type="radio"
              name={`section-${finding.id}`}
              value={opt.value}
              checked={finding.section === opt.value}
              onChange={() => onUpdate({ section: opt.value })}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Fields */}
      <Input
        label="Finding"
        value={finding.finding}
        onChange={(v) => onUpdate({ finding: v })}
        placeholder="Description of what was observed"
        multiline
        rows={2}
      />
      <Input
        label="Recommendation"
        value={finding.recommendation}
        onChange={(v) => onUpdate({ recommendation: v })}
        placeholder="Corrective action recommended"
        multiline
        rows={2}
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label="Location"
            value={finding.location}
            onChange={(v) => onUpdate({ location: v })}
            placeholder="Where on property"
          />
        </div>
        <Input
          label="Est. Cost"
          value={finding.cost ? String(finding.cost) : ''}
          onChange={(v) => onUpdate({ cost: parseFloat(v) || 0 })}
          type="number"
          placeholder="0"
          mono
        />
      </div>
    </div>
  )
}
