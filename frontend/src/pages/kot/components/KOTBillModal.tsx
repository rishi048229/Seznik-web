import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { UpiQrPanel } from '@/components/common/UpiQrPanel'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { formatINR } from '@/utils/currency'
import { Wallet, CreditCard, Smartphone, UserPlus, AlertTriangle, Printer, Ban } from 'lucide-react'
import type { KOTBillPayload, KOTBillVoidLine, KOTOrderType } from '@/types/kot.types'
import { formatAddOnsForDisplay, kotLineSubtotal, splitKotModifiers } from '@/utils/kotAddOns'
import type { KotRoomType } from '@/types/settings.types'
import {
  computeServiceCharge,
  mergeKotConfig,
  roomChargeFor,
  roomChargeLabel,
  visibleOrderTypes,
} from '../kotConfig'

export type KOTBillLinePreview = {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  taxRate?: number
  modifiers?: string[]
  sentToKitchenAt?: string | null
  isPending?: boolean
}

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
  billItems: KOTBillLinePreview[]
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
  billItems,
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
  const [voids, setVoids] = useState<KOTBillVoidLine[]>([])
  const [voidDraft, setVoidDraft] = useState<{ itemId: string; reason: string; printVoidKot: boolean } | null>(null)

  const voidIds = new Set(voids.map((v) => v.itemId))
  const adjustedSubtotal = useMemo(
    () =>
      billItems
        .filter((it) => !voidIds.has(it.id))
        .reduce((s, it) => s + kotLineSubtotal(it), 0),
    [billItems, voids]
  )
  const adjustedItemTax = useMemo(
    () =>
      billItems
        .filter((it) => !voidIds.has(it.id))
        .reduce((s, it) => s + (kotLineSubtotal(it) * (it.taxRate || 0)) / 100, 0),
    [billItems, voids]
  )

  const discountNum = parseFloat(discount) || 0
  const taxRateNum = parseFloat(taxPercent)
  const taxAmount =
    overrideTax && !Number.isNaN(taxRateNum) ? (adjustedSubtotal * taxRateNum) / 100 : adjustedItemTax || itemTax
  const serviceNum = kot.showServiceCharge ? Math.max(0, parseFloat(serviceCharge) || 0) : 0
  const roomNum = kot.showRoomCharges && roomType !== 'none' ? Math.max(0, parseFloat(roomAmount) || 0) : 0
  const net = Math.max(0, adjustedSubtotal + taxAmount + serviceNum + roomNum - discountNum)
  const amountPaidNum = parseFloat(amountPaid) || 0
  const unpaidAmount = Math.max(0, net - amountPaidNum)
  const change = Math.max(0, amountPaidNum - net)
  const activeItems = billItems.filter((it) => !voidIds.has(it.id) && !it.isPending)
  const isComplete = unpaidAmount <= 0.01 || Boolean(customerId)

  const buildPayload = (printBill: boolean): KOTBillPayload => ({
    paymentMethod: method,
    discount: discountNum,
    amountPaid: method === 'credit' ? 0 : amountPaidNum,
    customerId: customerId || undefined,
    orderType,
    taxRate: overrideTax ? (Number.isNaN(taxRateNum) ? 0 : taxRateNum) : null,
    serviceCharge: serviceNum,
    roomCharge: roomNum,
    roomChargeLabel: roomChargeLabel(roomType),
    printBill,
    voids: voids.map((v) => {
      const row = billItems.find((it) => it.id === v.itemId)
      return {
        ...v,
        wasSentToKitchen: !!row?.sentToKitchenAt,
      }
    }),
  })

  useEffect(() => {
    if (!isOpen) return
    setVoids([])
    setVoidDraft(null)
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
      { label: 'Food subtotal', value: adjustedSubtotal },
      { label: overrideTax ? `Tax (${taxPercent || 0}%)` : 'Item tax', value: taxAmount },
      { label: 'Service charge', value: serviceNum },
      ...(roomNum > 0 ? [{ label: roomChargeLabel(roomType), value: roomNum }] : []),
      ...(discountNum > 0 ? [{ label: 'Discount', value: -discountNum }] : []),
    ],
    [adjustedSubtotal, overrideTax, taxPercent, taxAmount, serviceNum, roomNum, roomType, discountNum]
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Bill"
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button
            variant="outline"
            onClick={() => onSettle(buildPayload(false))}
            disabled={!isComplete || loading || net < 0 || activeItems.length === 0}
            loading={loading}
            className="flex-1 py-3"
          >
            Settle without print
          </Button>
          <Button
            onClick={() => onSettle(buildPayload(true))}
            disabled={!isComplete || loading || net < 0 || activeItems.length === 0}
            loading={loading}
            className="flex-1 py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            {isComplete ? 'Print bill & settle' : 'Select customer for unpaid balance'}
          </Button>
        </div>
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
                    ? 'bg-[#0a0a2e] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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

        {billItems.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order lines</p>
            <ul className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
              {billItems.map((it) => {
                if (voidIds.has(it.id)) return null
                const { kitchen } = splitKotModifiers(it.modifiers)
                const addOns = formatAddOnsForDisplay(it.modifiers)
                const lineTotal = kotLineSubtotal(it)
                return (
                  <li key={it.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {it.quantity} × {it.productName}
                        {it.isPending ? <span className="text-[10px] text-sky-600 ml-1">(unsaved)</span> : null}
                      </p>
                      {kitchen.length > 0 && (
                        <p className="text-[11px] italic text-gray-500">* {kitchen.join(', ')}</p>
                      )}
                      {addOns && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">+ {addOns}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-semibold">{formatINR(lineTotal)}</span>
                      {!it.isPending && (
                        <button
                          type="button"
                          className="text-[11px] text-red-600 hover:underline inline-flex items-center gap-0.5"
                          onClick={() =>
                            setVoidDraft({
                              itemId: it.id,
                              reason: '',
                              printVoidKot: !!it.sentToKitchenAt,
                            })
                          }
                        >
                          <Ban size={12} />
                          Cancel line
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {voidDraft && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-800 dark:text-red-200">Cancel this item?</p>
                <Input
                  placeholder="Reason (optional)"
                  value={voidDraft.reason}
                  onChange={(e) => setVoidDraft((d) => (d ? { ...d, reason: e.target.value } : d))}
                />
                {billItems.find((it) => it.id === voidDraft.itemId)?.sentToKitchenAt && (
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={voidDraft.printVoidKot}
                      onChange={(e) => setVoidDraft((d) => (d ? { ...d, printVoidKot: e.target.checked } : d))}
                    />
                    Print kitchen void slip
                  </label>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setVoidDraft(null)}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      setVoids((prev) => [
                        ...prev,
                        {
                          itemId: voidDraft.itemId,
                          reason: voidDraft.reason.trim() || undefined,
                          printVoidKot: voidDraft.printVoidKot,
                        },
                      ])
                      setVoidDraft(null)
                    }}
                  >
                    Remove from bill
                  </Button>
                </div>
              </div>
            )}
            {voids.length > 0 && (
              <p className="text-[11px] text-red-600">{voids.length} line(s) will be cancelled when you settle.</p>
            )}
          </div>
        )}

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
                    ? 'bg-[#0a0a2e] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
              { id: 'credit' as const, label: 'Udhar', icon: UserPlus },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`group flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl transition-colors duration-150 ${
                  method === id
                    ? 'bg-[#0a0a2e] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={18} strokeWidth={method === id ? 2.2 : 1.75} />
                <span className="text-[11px] sm:text-xs font-medium">{label}</span>
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
