import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { UpiQrPanel } from '@/components/common/UpiQrPanel'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { formatINR } from '@/utils/currency'
import { Wallet, CreditCard, Smartphone, UserPlus, AlertTriangle, Printer } from 'lucide-react'
import type { KOTBillPayload, KOTOrderType } from '@/types/kot.types'
import type { KotRoomType } from '@/types/settings.types'
import {
  computeServiceCharge,
  mergeKotConfig,
  ORDER_TYPE_OPTIONS,
  roomChargeFor,
  roomChargeLabel,
} from '../kotConfig'

interface KOTBillModalProps {
  isOpen: boolean
  onClose: () => void
  subtotal: number
  itemTax: number
  orderType: KOTOrderType
  onOrderTypeChange: (type: KOTOrderType) => void
  customerId: string
  onCustomerChange: (id: string) => void
  loading: boolean
  onSettle: (payload: KOTBillPayload) => void
}

export const KOTBillModal = ({
  isOpen,
  onClose,
  subtotal,
  itemTax,
  orderType,
  onOrderTypeChange,
  customerId,
  onCustomerChange,
  loading,
  onSettle,
}: KOTBillModalProps) => {
  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const kot = mergeKotConfig(settings?.kotConfig)
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash')
  const [discount, setDiscount] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [taxPercent, setTaxPercent] = useState('')
  const [overrideTax, setOverrideTax] = useState(false)
  const [serviceCharge, setServiceCharge] = useState('')
  const [roomType, setRoomType] = useState<KotRoomType>('none')
  const [roomAmount, setRoomAmount] = useState('')

  const discountNum = parseFloat(discount) || 0
  const taxRateNum = parseFloat(taxPercent)
  const taxAmount = overrideTax && !Number.isNaN(taxRateNum) ? (subtotal * taxRateNum) / 100 : itemTax
  const serviceNum = Math.max(0, parseFloat(serviceCharge) || 0)
  const roomNum = roomType === 'none' ? 0 : Math.max(0, parseFloat(roomAmount) || 0)
  const net = Math.max(0, subtotal + taxAmount + serviceNum + roomNum - discountNum)
  const amountPaidNum = parseFloat(amountPaid) || 0
  const unpaidAmount = Math.max(0, net - amountPaidNum)
  const change = Math.max(0, amountPaidNum - net)
  const isComplete = unpaidAmount <= 0.01 || Boolean(customerId)

  useEffect(() => {
    if (!isOpen) return
    setMethod('cash')
    setDiscount('')
    setOverrideTax(kot.applyTaxOverride)
    setTaxPercent(kot.applyTaxOverride || kot.taxRate ? String(kot.taxRate) : itemTax > 0 && subtotal > 0 ? (itemTax / subtotal * 100).toFixed(2) : '0')
    setServiceCharge(String(computeServiceCharge(subtotal, kot) || ''))
    setRoomType(kot.defaultRoomType)
    setRoomAmount(String(roomChargeFor(kot.defaultRoomType, kot) || ''))
    // amountPaid set below after net is known via the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subtotal, itemTax])

  useEffect(() => {
    if (!isOpen) return
    if (method === 'credit') {
      setAmountPaid('0')
      return
    }
    setAmountPaid(net > 0 ? String(Number(net.toFixed(2))) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, method, net])

  const breakdown = useMemo(
    () => [
      { label: 'Food subtotal', value: subtotal },
      { label: overrideTax ? `Tax (${taxPercent || 0}%)` : 'Item tax', value: taxAmount },
      { label: 'Service charge', value: serviceNum },
      ...(roomNum > 0 ? [{ label: roomChargeLabel(roomType), value: roomNum }] : []),
      ...(discountNum > 0 ? [{ label: 'Discount', value: -discountNum }] : []),
    ],
    [subtotal, overrideTax, taxPercent, taxAmount, serviceNum, roomNum, roomType, discountNum]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Bill"
      size="lg"
      footer={
        <Button
          onClick={() =>
            onSettle({
              paymentMethod: method,
              discount: discountNum,
              amountPaid: method === 'credit' ? 0 : amountPaidNum,
              customerId: customerId || undefined,
              orderType,
              taxRate: overrideTax ? (Number.isNaN(taxRateNum) ? 0 : taxRateNum) : null,
              serviceCharge: serviceNum,
              roomCharge: roomNum,
              roomChargeLabel: roomChargeLabel(roomType),
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
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Order type</p>
          <div className="grid grid-cols-3 gap-2">
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onOrderTypeChange(opt.id)}
                className={`py-2 rounded-lg text-sm font-semibold border-2 ${
                  orderType === opt.id
                    ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 text-[#0a0a2e]'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center py-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">Amount due</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(net)}</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-1.5 text-sm">
          {breakdown.map((row) => (
            <div key={row.label} className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{row.label}</span>
              <span className="font-semibold">{formatINR(row.value)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              <input
                type="checkbox"
                checked={overrideTax}
                onChange={(e) => setOverrideTax(e.target.checked)}
              />
              Override tax %
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={taxPercent}
              onChange={(e) => {
                setOverrideTax(true)
                setTaxPercent(e.target.value)
              }}
              disabled={!overrideTax}
            />
          </div>
          <Input
            label="Service charge (₹)"
            type="number"
            min={0}
            step="0.01"
            value={serviceCharge}
            onChange={(e) => setServiceCharge(e.target.value)}
            placeholder="0"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Room charge</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {([
              { id: 'none' as const, label: 'None' },
              { id: 'ac' as const, label: 'AC' },
              { id: 'non_ac' as const, label: 'Non-AC' },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setRoomType(opt.id)
                  setRoomAmount(String(roomChargeFor(opt.id, kot) || ''))
                }}
                className={`py-2 rounded-lg text-sm font-semibold border-2 ${
                  roomType === opt.id
                    ? 'border-[#0a0a2e] bg-[#0a0a2e]/5 text-[#0a0a2e]'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {roomType !== 'none' && (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={roomAmount}
              onChange={(e) => setRoomAmount(e.target.value)}
              placeholder="0"
            />
          )}
        </div>

        <CustomerSelect value={customerId} onChange={onCustomerChange} size="compact" />

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Discount (₹)</label>
          <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment method</label>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
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
                className={`flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                  method === id ? 'border-[#0a0a2e] bg-[#0a0a2e]/5' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon size={20} className={method === id ? 'text-[#0a0a2e]' : 'text-gray-400'} />
                <span className={`text-[11px] sm:text-xs font-medium ${method === id ? 'text-[#0a0a2e]' : 'text-gray-500'}`}>{label}</span>
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
