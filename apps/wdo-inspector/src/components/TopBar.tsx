import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useReportStore } from '../store/useReportStore'

export function TopBar() {
  const isOnline = useOnlineStatus()
  const lastSaved = useReportStore((s) => s.lastSaved)
  const reportNumber = useReportStore((s) => s.report.reportNumber)

  const savedLabel = lastSaved
    ? `Saved ${new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-text">WDO Inspector</h1>
          <span className="font-mono text-xs text-text-2">{reportNumber}</span>
        </div>
        <div className="flex items-center gap-3">
          {savedLabel && <span className="text-xs text-success">{savedLabel}</span>}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-section1'}`} />
            <span className="text-xs text-text-2">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
