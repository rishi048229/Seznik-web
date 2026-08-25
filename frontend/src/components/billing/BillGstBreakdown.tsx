import { formatINR } from '@/utils/currency'
import type { GstBreakdownStyle } from '@/constants/gstBilling'
import type { GstBillSummary } from '@/utils/gst'

interface BillGstBreakdownProps {
  summary: GstBillSummary
  style: GstBreakdownStyle
}

export function BillGstBreakdown({ summary, style }: BillGstBreakdownProps) {
  if (summary.totalGst <= 0 && summary.taxableValue <= 0) return null

  if (style === 'slab_wise') {
    return (
      <div className="space-y-1.5">
        {summary.slabs.map((slab) => (
          <div key={String(slab.gstRate)} className="space-y-1">
            {slab.gstRate === 0 ? (
              <Row label="Nil Rated / Exempt" value={formatINR(slab.taxableValue)} muted />
            ) : (
              <>
                <Row label={`Taxable @ ${slab.gstRate}%`} value={formatINR(slab.taxableValue)} muted />
                <Row label={`CGST @ ${slab.cgstRate}%`} value={formatINR(slab.cgstAmount)} accent />
                <Row label={`SGST @ ${slab.sgstRate}%`} value={formatINR(slab.sgstAmount)} accent />
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Row label="Taxable Value" value={formatINR(summary.taxableValue)} muted />
      <Row label="CGST" value={formatINR(summary.cgstAmount)} accent />
      <Row label="SGST" value={formatINR(summary.sgstAmount)} accent />
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  accent,
}: {
  label: string
  value: string
  muted?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? 'text-gray-500 dark:text-gray-400' : accent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}>
        {label}
      </span>
      <span className={`font-semibold ${accent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {accent ? `+${value}` : value}
      </span>
    </div>
  )
}
