import type { Outcome } from '@grund/shared'

const filters: { label: string; value: Outcome | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Failures', value: 'failure' },
  { label: 'Escalations', value: 'escalation' },
  { label: 'Success', value: 'success' },
  { label: 'Unclear', value: 'unclear' },
]

interface FilterBarProps {
  active: Outcome | undefined
  onChange: (outcome: Outcome | undefined) => void
}

export function FilterBar({ active, onChange }: FilterBarProps) {
  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <button
          key={f.label}
          onClick={() => onChange(f.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === f.value
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
