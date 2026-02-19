import { Input } from '../shared/Input'
import { useReportStore } from '../../store/useReportStore'

export function ReportInfo() {
  const report = useReportStore((s) => s.report)
  const updateField = useReportStore((s) => s.updateField)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text">
          Report Info & Property
        </h2>
        <p className="text-sm text-text-2 mt-1">
          Basic inspection and property details
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Report Number"
          value={report.reportNumber}
          onChange={(v) => updateField('reportNumber', v)}
          mono
        />
        <Input
          label="Inspection Date"
          value={report.inspectionDate}
          onChange={(v) => updateField('inspectionDate', v)}
          type="date"
          required
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Property Address
        </h3>
        <Input
          label="Street Address"
          value={report.propertyAddress}
          onChange={(v) => updateField('propertyAddress', v)}
          placeholder="123 Main Street"
          required
        />
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <Input
              label="City"
              value={report.propertyCity}
              onChange={(v) => updateField('propertyCity', v)}
              placeholder="Sacramento"
              required
            />
          </div>
          <div className="col-span-1">
            <Input
              label="State"
              value={report.propertyState}
              onChange={(v) => updateField('propertyState', v)}
            />
          </div>
          <div className="col-span-2">
            <Input
              label="ZIP"
              value={report.propertyZip}
              onChange={(v) => updateField('propertyZip', v)}
              placeholder="95814"
            />
          </div>
        </div>
      </div>

      <Input
        label="Property Description"
        value={report.propertyDescription}
        onChange={(v) => updateField('propertyDescription', v)}
        placeholder="One-story single family residence, wood frame, composition roof, occupied/furnished, attached garage"
        multiline
        rows={3}
      />
    </div>
  )
}
