import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { Sale, ReturnItemRequest } from '@/types/sale.types'
import { createSaleReturn, getReturnsForSale } from '@/services/saleReturnService'
import { calculateReturnSummary } from '@shared/saleReturnCalculator'
import { formatINR } from '@/utils/currency'
import { RotateCcw, AlertCircle, CheckCircle2, ShieldCheck, Box } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface ProcessReturnModalProps {
  sale: Sale
  isOpen: boolean
  onClose: () => void
  onSuccess: (newReturn: any) => void
}

export const ProcessReturnModal = ({
  sale,
  isOpen,
  onClose,
  onSuccess,
}: ProcessReturnModalProps) => {
  const [loadingPastReturns, setLoadingPastReturns] = useState(false)
  const [pastReturns, setPastReturns] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number; restock: boolean }>>({})
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal'>(
    sale.paymentMethod === 'credit' ? 'credit_reversal' : 'cash'
  )
  const [reason, setReason] = useState('customer_changed_mind')
  const [notes, setNotes] = useState('')
  const [refundExtraCharges, setRefundExtraCharges] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch past returns for this sale
  useEffect(() => {
    if (!isOpen || !sale?.id) return

    let isMounted = true
    setLoadingPastReturns(true)
    getReturnsForSale(sale.id)
      .then((returns) => {
        if (isMounted) {
          setPastReturns(returns || [])
          // Initialize selection state
          const initial: Record<string, { selected: boolean; quantity: number; restock: boolean }> = {}
          const items = Array.isArray(sale.items) ? sale.items : []

          items.forEach((item, index) => {
            const key = item.productId || item.productName || `item-${index}`
            // Compute past returned qty
            let returnedQty = 0
            for (const past of returns || []) {
              const pastItems = Array.isArray(past.items) ? past.items : []
              for (const p of pastItems) {
                if (p.productId === item.productId || p.productName === item.productName) {
                  returnedQty += Number(p.quantity) || 0
                }
              }
            }
            const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty)
            initial[key] = {
              selected: remaining > 0,
              quantity: remaining,
              restock: true,
            }
          })
          setSelectedItems(initial)
        }
      })
      .catch((err) => console.error('Failed to load past returns', err))
      .finally(() => {
        if (isMounted) setLoadingPastReturns(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, sale?.id])

  // Calculate remaining quantities per line item
  const itemRemainingMap = useMemo(() => {
    const map = new Map<string, number>()
    const items = Array.isArray(sale.items) ? sale.items : []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`
      let returnedQty = 0
      for (const past of pastReturns) {
        const pastItems = Array.isArray(past.items) ? past.items : []
        for (const p of pastItems) {
          if (p.productId === item.productId || p.productName === item.productName) {
            returnedQty += Number(p.quantity) || 0
          }
        }
      }
      const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty)
      map.set(key, remaining)
    })
    return map
  }, [sale.items, pastReturns])

  // Dynamic preview calculation
  const computedSummary = useMemo(() => {
    const items = Array.isArray(sale.items) ? sale.items : []
    const requests: ReturnItemRequest[] = []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`
      const state = selectedItems[key]
      if (state && state.selected && state.quantity > 0) {
        requests.push({
          productId: item.productId,
          productName: item.productName,
          quantity: state.quantity,
          restock: state.restock,
        })
      }
    })

    const extra = refundExtraCharges ? (sale.extraChargesTotal || 0) : 0
    try {
      return calculateReturnSummary(items as any, requests, extra, {
        subtotal: sale.subtotal,
        totalDiscount: sale.totalDiscount,
        totalTax: sale.totalTax,
        grandTotal: sale.grandTotal,
        extraChargesTotal: sale.extraChargesTotal,
        pastReturns,
      })
    } catch {
      return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 }
    }
  }, [sale, selectedItems, refundExtraCharges, pastReturns])

  const handleToggleSelect = (key: string) => {
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: false, quantity: 1, restock: true }
      return {
        ...prev,
        [key]: { ...curr, selected: !curr.selected },
      }
    })
  }

  const handleQuantityChange = (key: string, val: number) => {
    const max = itemRemainingMap.get(key) || 1
    const cleanVal = Math.max(1, Math.min(val, max))
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true }
      return {
        ...prev,
        [key]: { ...curr, quantity: cleanVal },
      }
    })
  }

  const handleToggleRestock = (key: string) => {
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true }
      return {
        ...prev,
        [key]: { ...curr, restock: !curr.restock },
      }
    })
  }

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, { selected: boolean; quantity: number; restock: boolean }> = {}
    const items = Array.isArray(sale.items) ? sale.items : []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`
      const remaining = itemRemainingMap.get(key) || 0
      updated[key] = {
        selected: select && remaining > 0,
        quantity: remaining,
        restock: true,
      }
    })
    setSelectedItems(updated)
  }

  const handleSubmitReturn = async () => {
    if (computedSummary.items.length === 0) {
      toast.error('Please select at least one item to return')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        items: computedSummary.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          restock: i.restock,
        })),
        refundMethod,
        reason,
        notes,
        extraChargesRefunded: computedSummary.extraChargesRefunded,
      }

      const res = await createSaleReturn(sale.id, payload)
      toast.success(`Return processed successfully! (${res.saleReturn.returnNumber})`)
      onSuccess(res.saleReturn)
      onClose()
    } catch (err: any) {
      toastError(err, 'Failed to process sales return')
    } finally {
      setIsSubmitting(false)
    }
  }

  const allItemsUnavailable = useMemo(() => {
    return Array.from(itemRemainingMap.values()).every((qty) => qty === 0)
  }, [itemRemainingMap])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Sales Return & Refund" size="lg">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Invoice Summary Header */}
        <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Invoice #{sale.invoiceNumber}
              </span>
              {sale.returnStatus && sale.returnStatus !== 'none' && (
                <Badge variant={sale.returnStatus === 'full' ? 'danger' : 'warning'}>
                  {sale.returnStatus === 'full' ? 'Fully Returned' : 'Partially Returned'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Original Grand Total: <strong className="text-slate-700 dark:text-slate-300">{formatINR(sale.grandTotal)}</strong>
              {sale.totalRefunded ? ` • Previously Refunded: ${formatINR(sale.totalRefunded)}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={allItemsUnavailable}
              onClick={() => handleSelectAll(true)}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={allItemsUnavailable}
              onClick={() => handleSelectAll(false)}
            >
              Deselect All
            </Button>
          </div>
        </div>

        {loadingPastReturns ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : allItemsUnavailable ? (
          <div className="p-6 text-center bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertCircle className="mx-auto text-amber-600 mb-2" size={32} />
            <h4 className="font-bold text-amber-900 dark:text-amber-200">All Items Already Returned</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Every unit from this invoice has already been returned and refunded.
            </p>
          </div>
        ) : (
          /* Items Selection Table */
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3 text-left w-10">Select</th>
                  <th className="py-2.5 px-3 text-left">Item Name</th>
                  <th className="py-2.5 px-3 text-center">Return Qty</th>
                  <th className="py-2.5 px-3 text-center">Restock?</th>
                  <th className="py-2.5 px-3 text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sale.items?.map((item, idx) => {
                  const key = item.productId || item.productName || `item-${idx}`
                  const remaining = itemRemainingMap.get(key) || 0
                  const state = selectedItems[key] || { selected: false, quantity: 1, restock: true }
                  const isAvailable = remaining > 0

                  // Calculate single item refund preview
                  const singleRefund = computedSummary.items.find((i) => i.productName === item.productName)?.refundAmount || 0

                  return (
                    <tr
                      key={key}
                      className={`${!isAvailable ? 'opacity-50 bg-slate-50 dark:bg-slate-900/40' : state.selected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          disabled={!isAvailable}
                          checked={state.selected && isAvailable}
                          onChange={() => handleToggleSelect(key)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Orig: {item.quantity} units @ {formatINR(item.sellingPrice)}
                          {remaining < item.quantity && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium ml-1.5">
                              ({remaining} remaining)
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isAvailable && state.selected ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(key, state.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={remaining}
                              value={state.quantity}
                              onChange={(e) => handleQuantityChange(key, parseInt(e.target.value) || 1)}
                              className="w-12 text-center text-sm py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(key, state.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isAvailable && state.selected ? (
                          <button
                            type="button"
                            onClick={() => handleToggleRestock(key)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              state.restock
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <Box size={13} />
                            {state.restock ? 'Restock' : 'Damaged / No'}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
                        {state.selected && isAvailable ? formatINR(singleRefund) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Extra Charges option (if applicable) */}
        {(sale.extraChargesTotal || 0) > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                Refund Extra / Delivery Charges ({formatINR(sale.extraChargesTotal || 0)})
              </p>
              <p className="text-[11px] text-slate-500">Only check this if returning full invoice charges</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={refundExtraCharges}
                onChange={(e) => setRefundExtraCharges(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        )}

        {/* Refund Calculation Summary Box */}
        <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Taxable Subtotal (returnsDeducted):</span>
            <span className="text-slate-200 font-medium">{formatINR(computedSummary.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>GST Output Tax Reversal (returnsTaxDeducted):</span>
            <span className="text-slate-200 font-medium">{formatINR(computedSummary.totalTax)}</span>
          </div>
          {computedSummary.extraChargesRefunded > 0 && (
            <div className="flex justify-between text-xs text-slate-400">
              <span>Extra Charges Refunded:</span>
              <span className="text-slate-200 font-medium">{formatINR(computedSummary.extraChargesRefunded)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800 text-white">
            <span>TOTAL REFUND TO CUSTOMER:</span>
            <span className="text-emerald-400">{formatINR(computedSummary.refundAmount)}</span>
          </div>
        </div>

        {/* Refund Details Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Refund Method
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as any)}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash (Physical Cash Out)</option>
              <option value="upi">UPI / Bank Transfer</option>
              <option value="card">Card Reversal</option>
              <option value="store_credit">Store Credit / Wallet</option>
              <option value="credit_reversal">Customer Credit Ledger Reversal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Return Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="customer_changed_mind">Customer Changed Mind</option>
              <option value="defective">Defective / Damaged</option>
              <option value="wrong_item">Wrong Item Sent/Purchased</option>
              <option value="exchange">Customer Exchange</option>
              <option value="other">Other Reason</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Internal Notes (Optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Approved by store manager, customer wanted size L"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={computedSummary.refundAmount <= 0 || allItemsUnavailable}
            loading={isSubmitting}
            onClick={handleSubmitReturn}
            leftIcon={<RotateCcw size={16} />}
          >
            Confirm Return ({formatINR(computedSummary.refundAmount)})
          </Button>
        </div>
      </div>
    </Modal>
  )
}
