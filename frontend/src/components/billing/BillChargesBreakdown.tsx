import { formatINR } from '@/utils/currency'
import type { AppliedBillCharge } from '@/constants/restaurantBilling'

interface BillChargesBreakdownProps {
  charges: AppliedBillCharge[]
}

export function BillChargesBreakdown({ charges }: BillChargesBreakdownProps) {
  if (!charges.length) return null

  return (
    <div className="space-y-1">
      {charges.map((charge) => (
        <div key={charge.presetId} className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{charge.label}</span>
          <span className="font-semibold text-violet-600 dark:text-violet-400">+{formatINR(charge.amount)}</span>
        </div>
      ))}
    </div>
  )
}
