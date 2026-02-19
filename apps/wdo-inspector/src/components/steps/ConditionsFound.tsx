import { Checkbox } from '../shared/Checkbox'
import { useReportStore } from '../../store/useReportStore'

export function ConditionsFound() {
  const conditions = useReportStore((s) => s.report.conditions)
  const updateCondition = useReportStore((s) => s.updateCondition)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text">Conditions Found</h2>
        <p className="text-sm text-text-2 mt-1">
          Check all conditions observed during inspection
        </p>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4 space-y-1">
        <Checkbox
          label="Subterranean Termites"
          checked={conditions.subterraneanTermites}
          onChange={(v) => updateCondition('subterraneanTermites', v)}
          description="Evidence of subterranean termite infestation or damage"
        />
        <Checkbox
          label="Drywood Termites"
          checked={conditions.drywoodTermites}
          onChange={(v) => updateCondition('drywoodTermites', v)}
          description="Evidence of drywood termite infestation or damage"
        />
        <Checkbox
          label="Fungus / Dryrot"
          checked={conditions.fungusDryrot}
          onChange={(v) => updateCondition('fungusDryrot', v)}
          description="Evidence of fungus damage or wood decay"
        />
        <Checkbox
          label="Other Findings"
          checked={conditions.otherFindings}
          onChange={(v) => updateCondition('otherFindings', v)}
          description="Other wood destroying organisms or conditions"
        />

        <div className="border-t border-border my-3" />

        <Checkbox
          label="Further Inspection Needed"
          checked={conditions.furtherInspectionNeeded}
          onChange={(v) => updateCondition('furtherInspectionNeeded', v)}
          description="Areas that could not be fully inspected require further evaluation"
        />
      </div>

      <div className="bg-surface-2 rounded-lg p-4">
        <p className="text-xs text-text-2 leading-relaxed">
          <span className="font-semibold text-text">Note:</span> Conditions
          checked here should correspond to detailed findings in Step 5. Section
          I items are active infestations requiring action for clearance. Section
          II items are preventive recommendations.
        </p>
      </div>
    </div>
  )
}
