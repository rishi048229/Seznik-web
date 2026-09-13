import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useRecordPurchasePayment } from '@/hooks/usePurchases'
import { useRecordSupplierPayment } from '@/hooks/useSuppliers'
import { formatINR } from '@/utils/currency'
import { IndianRupee, CreditCard, Calendar, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Purchase } from '@/types/purchase.types'
import type { Supplier } from '@/types/supplier.types'

export interface RecordPurchasePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  purchase?: Purchase | null
  supplier?: Supplier | null
  onSuccess?: () => void
}

export const RecordPurchasePaymentModal = ({
  isOpen,
  onClose,
  purchase,
  supplier,
  onSuccess,
}: RecordPurchasePaymentModalProps) => {
  const purchaseOutstanding = purchase
    ? Math.max(0, (purchase.grandTotal || 0) - (purchase.amountPaid || 0))
    : 0
  const supplierOutstanding = supplier?.payableBalance ?? 0
  const defaultAmount = purchase ? purchaseOutstanding : supplierOutstanding

  const [amount, setAmount] = useState(() => (defaultAmount > 0 ? String(defaultAmount) : ''))
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi' | 'cash' | 'cheque'>('bank')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const { mutate: payPurchase, isPending: isPayingPurchase } = useRecordPurchasePayment()
  const { mutate: paySupplier, isPending: isPayingSupplier } = useRecordSupplierPayment()

  const isPending = isPayingPurchase || isPayingSupplier

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payNum = parseFloat(amount)
    if (!payNum || payNum <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    if (purchase) {
      payPurchase(
        {
          purchaseId: purchase.id,
          data: {
            amount: payNum,
            paymentMethod,
            notes: notes.trim() || undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success(`Payment of ${formatINR(payNum)} recorded for #${purchase.invoiceNumber}`)
            onSuccess?.()
            onClose()
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to record payment')
          },
        }
      )
    } else if (supplier) {
      paySupplier(
        {
          supplierId: supplier.id,
          data: {
            amount: payNum,
            paymentMethod,
            notes: notes.trim() || undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success(`Payment of ${formatINR(payNum)} recorded for ${supplier.name}`)
            onSuccess?.()
            onClose()
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to record supplier payment')
          },
        }
      )
    }
  }

  const title = purchase
    ? `Record Payment for Purchase #${purchase.invoiceNumber}`
    : supplier
    ? `Record Payment to ${supplier.name}`
    : 'Record Supplier Payment'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Outstanding Balance Banner */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              {purchase ? 'Outstanding on this Purchase' : 'Current Supplier Balance'}
            </p>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">
              {formatINR(defaultAmount)}
            </p>
          </div>
          {defaultAmount > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(defaultAmount))}
              className="text-xs px-2.5 py-1 bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100 font-bold rounded-lg hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
            >
              Pay Full ({formatINR(defaultAmount)})
            </button>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Payment Amount (₹) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-8 text-base font-bold"
              autoFocus
            />
            <IndianRupee size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Payment Method *
          </label>
          <Select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            options={[
              { value: 'bank', label: 'Bank Transfer / NEFT / RTGS' },
              { value: 'upi', label: 'UPI / QR Payment' },
              { value: 'cash', label: 'Cash Payment' },
              { value: 'cheque', label: 'Cheque' },
            ]}
          />
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Payment Date
          </label>
          <div className="relative">
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="pl-8"
            />
            <Calendar size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Notes / Reference */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Payment Notes / Reference
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="e.g. UTR #982348, Cheque #10293"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="pl-8"
            />
            <FileText size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={!parseFloat(amount)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5"
          >
            Confirm Payment ({formatINR(parseFloat(amount) || 0)})
          </Button>
        </div>
      </form>
    </Modal>
  )
}
