import { useReportStore, type ReportState } from '../store/useReportStore'

const STEPS = ['Report Info', 'Parties', 'Conditions', 'Diagram', 'Findings', 'Review']

export function StepIndicator() {
  const currentStep = useReportStore((s: ReportState) => s.currentStep)
  const setStep = useReportStore((s: ReportState) => s.setStep)

  return (
    <div className="bg-surface border-b border-border px-4 py-3">
      <div className="max-w-lg mx-auto">
        {/* Step pills - scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {STEPS.map((name, i) => {
            const isActive = i === currentStep
            const isCompleted = i < currentStep

            return (
              <button
                key={name}
                onClick={() => setStep(i)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors min-h-[36px]',
                  isActive
                    ? 'bg-accent text-white font-medium'
                    : isCompleted
                      ? 'bg-surface-2 text-text hover:bg-border'
                      : 'bg-transparent text-text-2 hover:bg-surface-2',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono',
                    isActive
                      ? 'bg-white/20'
                      : isCompleted
                        ? 'bg-success/20 text-success'
                        : 'bg-surface-2',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M8 3L4 7L2 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
