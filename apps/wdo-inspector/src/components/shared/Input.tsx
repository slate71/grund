interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  mono?: boolean
  required?: boolean
  multiline?: boolean
  rows?: number
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  mono,
  required,
  multiline,
  rows = 3,
}: InputProps) {
  const baseClasses = [
    'w-full rounded-lg bg-surface-2 border border-border px-4 py-3',
    'text-text placeholder:text-text-2/50',
    'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
    'transition-colors min-h-[44px]',
    mono ? 'font-mono text-sm' : 'text-base',
  ].join(' ')

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-2">
        {label}
        {required && <span className="text-section1 ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${baseClasses} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={baseClasses}
        />
      )}
    </div>
  )
}
