interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
}

export function Checkbox({ label, checked, onChange, description }: CheckboxProps) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer select-none">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-6 h-6 rounded-md border-2 border-border bg-surface-2 peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 transition-colors flex items-center justify-center">
          {checked && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
              <path
                d="M11.5 4L5.5 10L2.5 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <div>
        <span className="text-base font-medium text-text">{label}</span>
        {description && <p className="text-sm text-text-2 mt-0.5">{description}</p>}
      </div>
    </label>
  )
}
