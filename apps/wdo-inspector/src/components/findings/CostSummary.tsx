import type { Finding } from '../../types/report'

interface CostSummaryProps {
  findings: Finding[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CostSummary({ findings }: CostSummaryProps) {
  const section1Total = findings
    .filter((f) => f.section === 'section1')
    .reduce((sum, f) => sum + f.cost, 0)

  const section2Total = findings
    .filter((f) => f.section === 'section2')
    .reduce((sum, f) => sum + f.cost, 0)

  const furtherTotal = findings
    .filter((f) => f.section === 'further')
    .reduce((sum, f) => sum + f.cost, 0)

  const grandTotal = section1Total + section2Total + furtherTotal

  return (
    <div className="bg-surface rounded-lg border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
        Cost Summary
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-section1" />
            Section I
          </span>
          <span className="font-mono text-section1 font-medium">
            {formatCurrency(section1Total)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-section2" />
            Section II
          </span>
          <span className="font-mono text-section2 font-medium">
            {formatCurrency(section2Total)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-further" />
            Further Inspection
          </span>
          <span className="font-mono text-further font-medium">
            {formatCurrency(furtherTotal)}
          </span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between items-center">
          <span className="text-sm font-semibold text-text">Grand Total</span>
          <span className="font-mono text-lg font-bold text-text">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
