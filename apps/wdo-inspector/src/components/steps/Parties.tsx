import { Input } from '../shared/Input'
import { useReportStore, type ReportState } from '../../store/useReportStore'

export function Parties() {
  const report = useReportStore((s: ReportState) => s.report)
  const updateOrderedBy = useReportStore((s: ReportState) => s.updateOrderedBy)
  const updatePropertyOwner = useReportStore((s: ReportState) => s.updatePropertyOwner)
  const updateReportSentTo = useReportStore((s: ReportState) => s.updateReportSentTo)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text">Parties & Contacts</h2>
        <p className="text-sm text-text-2 mt-1">Who ordered, owns, and receives this report</p>
      </div>

      {/* Ordered By */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">Ordered By</h3>
        <Input
          label="Name"
          value={report.orderedBy.name}
          onChange={(v) => updateOrderedBy('name', v)}
          placeholder="Full name"
          required
        />
        <Input
          label="Address"
          value={report.orderedBy.address}
          onChange={(v) => updateOrderedBy('address', v)}
          placeholder="Street address, city, state, zip"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            value={report.orderedBy.phone}
            onChange={(v) => updateOrderedBy('phone', v)}
            type="tel"
            placeholder="(555) 123-4567"
          />
          <Input
            label="Email"
            value={report.orderedBy.email}
            onChange={(v) => updateOrderedBy('email', v)}
            type="email"
            placeholder="email@example.com"
          />
        </div>
      </section>

      {/* Property Owner */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Property Owner
        </h3>
        <Input
          label="Name"
          value={report.propertyOwner.name}
          onChange={(v) => updatePropertyOwner('name', v)}
          placeholder="Full name"
        />
        <Input
          label="Address"
          value={report.propertyOwner.address}
          onChange={(v) => updatePropertyOwner('address', v)}
          placeholder="Street address, city, state, zip"
        />
      </section>

      {/* Report Sent To */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Report Sent To
        </h3>
        <Input
          label="Name"
          value={report.reportSentTo.name}
          onChange={(v) => updateReportSentTo('name', v)}
          placeholder="Full name"
        />
        <Input
          label="Email"
          value={report.reportSentTo.email}
          onChange={(v) => updateReportSentTo('email', v)}
          type="email"
          placeholder="email@example.com"
        />
      </section>
    </div>
  )
}
