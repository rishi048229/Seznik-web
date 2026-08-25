import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { UpiQrPanel } from '@/components/common/UpiQrPanel'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { formatINR } from '@/utils/currency'
import { Wallet, CreditCard, Smartphone, UserPlus, AlertTriangle, Printer } from 'lucide-react'

interface KOTBillModalProps {
  isOpen: boolean
  onClose: () => void
  grandTotal: number
  customerId: string
  onCustomerChange: (id: string) => void
  loading: boolean
  onSettle: (payload: {
    paymentMethod: 'cash' | 'card' | 'upi' | 'credit'
    discount: number
    amountPaid: number
    customerId?: string
  }) => void
}

export const KOTBillModal = ({
  isOpen,
  onClose,
  grandTotal,
  customerId,
  onCustomerChange,
  loading,
  onSettle,
}: KOTBillModalProps) => {
  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash')
  const [discount, setDiscount] = useState('')
  const [amountPaid, setAmountPaid] = useState('')

  const discountNum = parseFloat(discount) || 0
  const net = Math.max(0, grandTotal - discountNum)
  const amountPaidNum = parseFloat(amountPaid) || 0
  const unpaidAmount = Math.max(0, net - amountPaidNum)
  const change = Math.max(0, amountPaidNum - net)
  const isComplete = unpaidAmount <= 0.01 || Boolean(customerId)

  useEffect(() => {
    if (isOpen) {
      setMethod('cash')
      setDiscount('')
      setAmountPaid(grandTotal > 0 ? String(grandTotal) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, grandTotal])

  useEffect(() => {
    if (method === 'credit') {
      setAmountPaid('0')
    } else if (isOpen && unpaidAmount > 0 && method !== 'credit') {
      setAmountPaid(String(net))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Bill"
      size="md"
      footer={
        <Button
          onClick={() =>
            onSettle({
              paymentMethod: method,
              discount: discountNum,
              amountPaid: method === 'credit' ? 0 : amountPaidNum,
              customerId: customerId || undefined,
            })
          }
          disabled={!isComplete || loading || net < 0}
          loading={loading}
          className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
        >
          <Printer size={18} className="mr-2" />
          {isComplete ? 'Print Bill & Mark Settled' : 'Select customer for unpaid balance'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="text-center py-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">Amount due</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(net)}</p>
        </div>

        <CustomerSelect value={customerId} onChange={onCustomerChange} size="compact" />

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Discount (₹)</label>
          <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment method</label>
          <div className="grid grid-cols-4 gap-3">
            {([
              { id: 'cash' as const, label: 'Cash', icon: Wallet },
              { id: 'card' as const, label: 'Card', icon: CreditCard },
              { id: 'upi' as const, label: 'UPI', icon: Smartphone },
              { id: 'credit' as const, label: 'Udhar', icon: UserPlus },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  method === id ? 'border-[#0a0a2e] bg-[#0a0a2e]/5' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon size={22} className={method === id ? 'text-[#0a0a2e]' : 'text-gray-400'} />
                <span className={`text-xs font-medium ${method === id ? 'text-[#0a0a2e]' : 'text-gray-500'}`}>{label}</span>
              </button>
            ))}
          </div>
          {method === 'upi' && settings?.receiptConfig?.upiId && (
            <div className="mt-3">
              <UpiQrPanel
                upiId={settings.receiptConfig.upiId}
                payeeName={settings?.businessName || 'Store'}
                amount={net}
              />
            </div>
          )}
        </div>

        {method !== 'credit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount received</label>
            <Input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="text-lg py-3 font-semibold"
            />
            {method === 'cash' && (
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountPaid(String(amt))}
                    className="flex-1 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    {formatINR(amt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {unpaidAmount > 0.01 ? (
          customerId ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <UserPlus size={15} />
                Remaining on credit
              </div>
              <p>
                {formatINR(amountPaidNum)} paid. Remaining <strong>{formatINR(unpaidAmount)}</strong> will be added to{' '}
                <strong>{customers?.find((c) => c.id === customerId)?.name}</strong>&apos;s credit balance.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={15} />
                Customer required for credit
              </div>
              <p>Select a registered customer to record unpaid balance, or collect full payment.</p>
            </div>
          )
        ) : change > 0 ? (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex justify-between">
            <span className="font-medium">Change</span>
            <span className="font-extrabold">{formatINR(change)}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
