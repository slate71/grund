import { useEffect } from 'react'
import { useReportStore, type ReportState } from './store/useReportStore'
import { TopBar } from './components/TopBar'
import { StepIndicator } from './components/StepIndicator'
import { ReportInfo } from './components/steps/ReportInfo'
import { Parties } from './components/steps/Parties'
import { ConditionsFound } from './components/steps/ConditionsFound'
import { PropertyDiagram } from './components/steps/PropertyDiagram'
import { Findings } from './components/steps/Findings'
import { ReviewSign } from './components/steps/ReviewSign'

const STEPS = [ReportInfo, Parties, ConditionsFound, PropertyDiagram, Findings, ReviewSign]

export function App() {
  const currentStep = useReportStore((s: ReportState) => s.currentStep)
  const isLoading = useReportStore((s: ReportState) => s.isLoading)
  const loadFromDB = useReportStore((s: ReportState) => s.loadFromDB)
  const nextStep = useReportStore((s: ReportState) => s.nextStep)
  const prevStep = useReportStore((s: ReportState) => s.prevStep)

  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        <div className="text-text-2 text-sm">Loading...</div>
      </div>
    )
  }

  const StepComponent = STEPS[currentStep]

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <TopBar />
      <StepIndicator />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <StepComponent />

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pb-8">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex-1 bg-surface-2 hover:bg-border text-text font-medium py-3 px-4 rounded-lg transition-colors min-h-[44px]"
              >
                Back
              </button>
            )}
            {currentStep < STEPS.length - 1 && (
              <button
                onClick={nextStep}
                className="flex-1 bg-accent hover:bg-accent-hover text-white font-medium py-3 px-4 rounded-lg transition-colors min-h-[44px]"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
