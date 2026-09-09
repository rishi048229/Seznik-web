import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { formatINR, roundCurrency } from '@/utils/currency'
import { Wallet, CreditCard, Smartphone, UserPlus, AlertTriangle, Printer } from 'lucide-react'
import type { KOTBillPayload, KOTOrderType } from '@/types/kot.types'
import type { KotRoomType } from '@/types/settings.types'
import {
  computeServiceCharge,
  mergeKotConfig,
  roomChargeFor,
  roomChargeLabel,
  visibleOrderTypes,
} from '../kotConfig'

interface KOTBillModalProps {
  isOpen: boolean
  onClose: () => void
  subtotal: number
  itemTax: number
  orderType: KOTOrderType
  onOrderTypeChange: (type: KOTOrderType) => void
  isRestaurant?: boolean
  tableNumber?: string
  onTableNumberChange?: (value: string) => void
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
  isRestaurant = false,
  tableNumber = '',
  onTableNumberChange,
  customerId,
  onCustomerChange,
  loading,
  onSettle,
}: KOTBillModalProps) => {
  const { data: settings } = useSettings()
  const { data: customers } = useCustomers()
  const kot = mergeKotConfig(settings?.kotConfig)
  const typeOptions = visibleOrderTypes(kot)
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
  const taxAmount = roundCurrency(overrideTax && !Number.isNaN(taxRateNum) ? (subtotal * taxRateNum) / 100 : itemTax)
  const serviceNum = kot.showServiceCharge ? Math.max(0, parseFloat(serviceCharge) || 0) : 0
  const roomNum = kot.showRoomCharges && roomType !== 'none' ? Math.max(0, parseFloat(roomAmount) || 0) : 0
  const net = roundCurrency(Math.max(0, subtotal + taxAmount + serviceNum + roomNum - discountNum))
  const amountPaidNum = parseFloat(amountPaid) || 0
  const unpaidAmount = roundCurrency(Math.max(0, net - amountPaidNum))
  const change = roundCurrency(Math.max(0, amountPaidNum - net))
  const isComplete = unpaidAmount <= 0.01 || Boolean(customerId)

  useEffect(() => {
    if (!isOpen) return
    setMethod('cash')
    setAmountPaid('')
    setDiscount('')
    setOverrideTax(kot.applyTaxOverride)
    setTaxPercent(kot.applyTaxOverride || kot.taxRate ? String(kot.taxRate) : itemTax > 0 && subtotal > 0 ? (itemTax / subtotal * 100).toFixed(2) : '0')
    setServiceCharge(String(computeServiceCharge(subtotal, kot) || ''))
    setRoomType(kot.defaultRoomType)
    setRoomAmount(String(roomChargeFor(kot.defaultRoomType, kot) || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subtotal, itemTax])

  useEffect(() => {
    if (!isOpen) return
    if (method === 'credit') {
      setAmountPaid('0')
      return
    }
    if (method === 'upi' || method === 'card') {
      setAmountPaid(net > 0 ? String(Number(net.toFixed(2))) : '')
    }
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
          className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#1a1555] dark:hover:bg-white"
        >
          <Printer size={18} className="mr-2" />
          {isComplete ? 'Print Bill & Mark Settled' : 'Select customer for unpaid balance'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Order type</p>
          <div className={`grid gap-1.5 ${typeOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {typeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onOrderTypeChange(opt.id)}
                className={`py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  orderType === opt.id
                    ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-elevated'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isRestaurant && orderType === 'dine_in' && (
            <div className="mt-2.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                Table Number / Name
              </label>
              <Input
                placeholder="e.g. Table 4, T-12, Outdoor 2"
                value={tableNumber}
                onChange={(e) => onTableNumberChange?.(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>

        <div className="text-center py-4 bg-gray-50 dark:bg-dark-elevated/50 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">Amount due</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(net)}</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-dark-border p-3 space-y-1.5 text-sm">
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
          {kot.showServiceCharge && (
            <Input
              label="Service charge (₹)"
              type="number"
              min={0}
              step="0.01"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
              placeholder="0"
            />
          )}
        </div>

        {kot.showRoomCharges && (
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
                className={`py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  roomType === opt.id
                    ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-elevated'
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
        )}

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
              { id: 'credit' as const, label: 'Credit', icon: UserPlus },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMethod(id)
                  if (id === 'credit') {
                    setAmountPaid('0')
                  } else if (id === 'upi' || id === 'card') {
                    setAmountPaid(net > 0 ? String(Number(net.toFixed(2))) : '')
                  } else {
                    setAmountPaid('')
                  }
                }}
                className={`group flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl transition-all duration-150 cursor-pointer ${
                  method === id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:bg-blue-600 dark:text-white'
                    : 'bg-gray-100 dark:bg-dark-card text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-elevated hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={18} strokeWidth={method === id ? 2.2 : 1.75} />
                <span className="text-[11px] sm:text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
          {method === 'upi' && settings?.upiId ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 text-center">
              Ask the customer to pay {formatINR(net)} to {settings.upiId}
            </p>
          ) : null}
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
              <div className="space-y-2 mt-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <span>Common Notes</span>
                  <button
                    type="button"
                    onClick={() => setAmountPaid(net.toFixed(2))}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                  >
                    Exact: {formatINR(net)}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[10, 20, 50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountPaid(String(amt))}
                      className={`py-2 px-1 text-xs font-bold border rounded-lg transition-all cursor-pointer ${
                        Number(amountPaid) === amt
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm'
                          : 'border-gray-200 dark:border-dark-border-strong bg-white dark:bg-dark-elevated text-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
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
