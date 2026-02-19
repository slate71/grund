import type { WDOReport } from '../types/report'

export function exportReportJSON(report: WDOReport): string {
  return JSON.stringify(report, null, 2)
}
