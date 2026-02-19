import type { Finding, FindingCategory } from '../types/report'

const CATEGORY_PREFIX: Record<FindingCategory, number> = {
  subterranean: 1,
  drywood: 2,
  fungus: 3,
  other: 4,
}

export function generateFindingLabel(
  category: FindingCategory,
  existingFindings: Finding[],
): string {
  const prefix = CATEGORY_PREFIX[category]
  const sameCategoryCount = existingFindings.filter((f) => f.category === category).length
  const letter = String.fromCharCode(65 + sameCategoryCount) // A, B, C...
  return `${prefix}${letter}`
}

export function recalculateLabels(findings: Finding[]): Finding[] {
  const counters: Record<FindingCategory, number> = {
    subterranean: 0,
    drywood: 0,
    fungus: 0,
    other: 0,
  }

  return findings.map((f) => {
    const prefix = CATEGORY_PREFIX[f.category]
    const letter = String.fromCharCode(65 + counters[f.category])
    counters[f.category]++
    return { ...f, label: `${prefix}${letter}` }
  })
}
