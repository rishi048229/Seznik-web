import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const REASONS = [
  'Customer left',
  'Wrong order',
  'Kitchen cannot fulfil',
  'Duplicate ticket',
  'Other',
]

interface CancelOrderDialogProps {
  isOpen: boolean
  onClose: () => void
  orderNumber?: number
  hadKitchen: boolean
  loading?: boolean
  onConfirm: (payload: { reason: string; printCancelSlip: boolean }) => void
}

export const CancelOrderDialog = ({
  isOpen,
  onClose,
  orderNumber,
  hadKitchen,
  loading,
  onConfirm,
}: CancelOrderDialogProps) => {
  const [reasonKey, setReasonKey] = useState('Customer left')
  const [other, setOther] = useState('')
  const [printCancelSlip, setPrintCancelSlip] = useState(true)

  const reason = reasonKey === 'Other' ? other.trim() : reasonKey
  const canSubmit = reason.length > 0 && !loading

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={orderNumber != null ? `Cancel KOT #${orderNumber}` : 'Cancel order'}
      size="sm"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
            Keep order
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={loading}
            disabled={!canSubmit}
            onClick={() => onConfirm({ reason, printCancelSlip: hadKitchen && printCancelSlip })}
          >
            Cancel order
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This frees the table if one is assigned. The ticket stays on Sales as Cancelled and is not counted in revenue.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setReasonKey(item)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                reasonKey === item
                  ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {reasonKey === 'Other' && (
          <Input
            placeholder="Reason"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        )}
        {hadKitchen && (
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={printCancelSlip}
              onChange={(e) => setPrintCancelSlip(e.target.checked)}
            />
            <span>Print a KOT CANCELLED slip so the kitchen stops preparing this ticket</span>
          </label>
        )}
      </div>
    </Modal>
  )
}
