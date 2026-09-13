import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import type { Purchase } from '@/types/purchase.types'
import type { PurchaseReturn, PurchaseReturnSettlementMethod, PurchaseReturnReason } from '@/types/purchaseReturn.types'
import { createPurchaseReturn, getReturnsForPurchase } from '@/services/purchaseReturnService'
import { calculatePurchaseReturnSummary, type PurchaseReturnItemRequest } from '@shared/purchaseReturnCalculator'
import { formatINR } from '@/utils/currency'
import { RotateCcw, AlertCircle, CheckCircle2, ShieldCheck, Box } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface ProcessPurchaseReturnModalProps {
  purchase: Purchase
  isOpen: boolean
  onClose: () => void
  onSuccess: (newReturn: PurchaseReturn) => void
}

export const ProcessPurchaseReturnModal = ({
  purchase,
  isOpen,
  onClose,
  onSuccess,
}: ProcessPurchaseReturnModalProps) => {
  const [loadingPastReturns, setLoadingPastReturns] = useState(false)
  const [pastReturns, setPastReturns] = useState<PurchaseReturn[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number }>>({})
  const [settlementMethod, setSettlementMethod] = useState<PurchaseReturnSettlementMethod>('adjust_against_payable')
  const [reason, setReason] = useState<PurchaseReturnReason>('damaged')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch past returns for this purchase
  useEffect(() => {
    if (!isOpen || !purchase?.id) return

    let isMounted = true
    setLoadingPastReturns(true)
    getReturnsForPurchase(purchase.id)
      .then((returns) => {
        if (isMounted) {
          setPastReturns(returns || [])
          // Initialize selection state
          const initial: Record<string, { selected: boolean; quantity: number }> = {}
          const items = Array.isArray(purchase.items) ? purchase.items : []

          items.forEach((item, index) => {
            const key = item.productId || item.productName || item.name || `item-${index}`
            // Compute past returned qty
            let returnedQty = 0
            for (const past of returns || []) {
              const pastItems = Array.isArray(past.items) ? past.items : []
              for (const p of pastItems) {
                if (p.productId === item.productId || p.productName === (item.productName || item.name)) {
                  returnedQty += Number(p.quantity) || 0
                }
              }
            }
            const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty)
            initial[key] = {
              selected: remaining > 0,
              quantity: remaining,
            }
          })
          setSelectedItems(initial)
        }
      })
      .catch((err) => console.error('Failed to load past purchase returns', err))
      .finally(() => {
        if (isMounted) setLoadingPastReturns(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, purchase?.id])

  // Calculate remaining quantities per line item
  const itemRemainingMap = useMemo(() => {
    const map = new Map<string, number>()
    const items = Array.isArray(purchase.items) ? purchase.items : []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || item.name || `item-${index}`
      let returnedQty = 0
      for (const past of pastReturns) {
        const pastItems = Array.isArray(past.items) ? past.items : []
        for (const p of pastItems) {
          if (p.productId === item.productId || p.productName === (item.productName || item.name)) {
            returnedQty += Number(p.quantity) || 0
          }
        }
      }
      const remaining = Math.max(0, (Number(item.quantity) || 1) - returnedQty)
      map.set(key, remaining)
    })
    return map
  }, [purchase.items, pastReturns])

  // Dynamic preview calculation
  const computedSummary = useMemo(() => {
    const items = Array.isArray(purchase.items) ? purchase.items : []
    const requests: PurchaseReturnItemRequest[] = []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || item.name || `item-${index}`
      const state = selectedItems[key]
      if (state && state.selected && state.quantity > 0) {
        requests.push({
          productId: item.productId,
          productName: item.productName || item.name,
          quantity: state.quantity,
          unitCost: item.costPrice || item.unitPrice,
        })
      }
    })

    try {
      return calculatePurchaseReturnSummary(items as any, requests, {
        subtotal: purchase.subtotal,
        totalTax: purchase.totalTax,
        grandTotal: purchase.grandTotal,
        pastReturns: pastReturns as any,
      })
    } catch {
      return { items: [], subtotal: 0, totalTax: 0, refundAmount: 0 }
    }
  }, [purchase, selectedItems, pastReturns])

  const handleToggleSelect = (key: string) => {
    setSelectedItems((prev) => {
      const curr = prev[key] || { selected: false, quantity: 1 }
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
      const curr = prev[key] || { selected: true, quantity: 1 }
      return {
        ...prev,
        [key]: { ...curr, quantity: cleanVal },
      }
    })
  }

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, { selected: boolean; quantity: number }> = {}
    const items = Array.isArray(purchase.items) ? purchase.items : []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || item.name || `item-${index}`
      const remaining = itemRemainingMap.get(key) || 0
      updated[key] = {
        selected: select && remaining > 0,
        quantity: remaining,
      }
    })
    setSelectedItems(updated)
  }

  const handleSubmitReturn = async () => {
    if (computedSummary.items.length === 0) {
      toast.error('Please select at least one item to return to supplier')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        items: computedSummary.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
        settlementMethod,
        reason,
        notes,
      }

      const res = await createPurchaseReturn(purchase.id, payload)
      toast.success(`Purchase return processed! Debit Note: ${res.purchaseReturn.returnNumber}`)
      onSuccess(res.purchaseReturn)
      onClose()
    } catch (err: any) {
      toastError(err, 'Failed to process purchase return')
    } finally {
      setIsSubmitting(false)
    }
  }

  const allItemsUnavailable = useMemo(() => {
    return Array.from(itemRemainingMap.values()).every((qty) => qty === 0)
  }, [itemRemainingMap])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Return to Supplier (Generate Debit Note)" size="lg">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Purchase Summary Header */}
        <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Purchase #{purchase.invoiceNumber}
              </span>
              {purchase.returnStatus && purchase.returnStatus !== 'none' && (
                <Badge variant={purchase.returnStatus === 'full' ? 'danger' : 'warning'}>
                  {purchase.returnStatus === 'full' ? 'Fully Returned' : 'Partially Returned'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Original Grand Total: <strong className="text-slate-700 dark:text-slate-300">{formatINR(purchase.grandTotal)}</strong>
              {purchase.totalReturned ? ` • Previously Debited: ${formatINR(purchase.totalReturned)}` : ''}
              {purchase.supplier?.name ? ` • Supplier: ${purchase.supplier.name}` : ''}
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
              onClick={() => handleSelectAll(false)}
            >
              Deselect All
            </Button>
          </div>
        </div>

        {loadingPastReturns ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 mt-2">Checking past debit notes...</p>
          </div>
        ) : allItemsUnavailable ? (
          <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
            <h4 className="text-base font-semibold text-amber-900 dark:text-amber-200">
              All Items Fully Returned
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 max-w-md">
              All quantities from this purchase have already been returned to the supplier under previous Debit Notes.
            </p>
          </div>
        ) : (
          <>
            {/* Items List */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Items & Quantities to Return
              </label>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {(Array.isArray(purchase.items) ? purchase.items : []).map((item, index) => {
                  const key = item.productId || item.productName || item.name || `item-${index}`
                  const remaining = itemRemainingMap.get(key) || 0
                  const state = selectedItems[key] || { selected: false, quantity: 1 }
                  const isAvailable = remaining > 0

                  return (
                    <div
                      key={key}
                      className={`p-3.5 transition-colors flex flex-wrap items-center justify-between gap-3 ${
                        state.selected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      } ${!isAvailable ? 'opacity-50 bg-slate-50 dark:bg-slate-800/40' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        <input
                          type="checkbox"
                          disabled={!isAvailable}
                          checked={state.selected && isAvailable}
                          onChange={() => handleToggleSelect(key)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {item.productName || item.name || 'Product'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>Cost: {formatINR(item.costPrice || item.unitPrice || 0)}</span>
                            <span>•</span>
                            <span>Originally Purchased: {item.quantity}</span>
                            <span>•</span>
                            <span className={remaining > 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-400'}>
                              Returnable: {remaining}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isAvailable && state.selected && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 font-medium">Return Qty:</label>
                            <input
                              type="number"
                              min="1"
                              max={remaining}
                              value={state.quantity}
                              onChange={(e) => handleQuantityChange(key, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 text-sm font-semibold text-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Return Settings & Reason */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Reason for Return
                </label>
                <Select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as PurchaseReturnReason)}
                  options={[
                    { value: 'damaged', label: 'Damaged / Defective Stock' },
                    { value: 'wrong_item', label: 'Wrong Item Delivered' },
                    { value: 'quality_reject', label: 'Quality Inspection Rejection' },
                    { value: 'excess_stock', label: 'Excess / Overstock Return' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Settlement Method
                </label>
                <Select
                  value={settlementMethod}
                  onChange={(e) => setSettlementMethod(e.target.value as PurchaseReturnSettlementMethod)}
                  options={[
                    { value: 'adjust_against_payable', label: 'Adjust Against Outstanding Payable' },
                    { value: 'supplier_credit', label: 'Supplier Credit Note / Advance' },
                    { value: 'cash', label: 'Cash Refund Received' },
                    { value: 'bank_transfer', label: 'Bank Transfer / UPI Refund' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes / Reference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Courier dispatch tracking # or supplier rejection slip"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Refund & Tax Breakdown Preview */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Taxable Value Reversed:</span>
                <span className="font-semibold text-slate-100">{formatINR(computedSummary.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Input Tax Credit (ITC) Reversal:</span>
                <span className="font-semibold text-slate-100">{formatINR(computedSummary.totalTax)}</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex items-center justify-between text-base font-bold text-white">
                <span>Total Debit Amount:</span>
                <span className="text-blue-400 text-lg">{formatINR(computedSummary.refundAmount)}</span>
              </div>
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReturn}
            loading={isSubmitting}
            disabled={allItemsUnavailable || computedSummary.items.length === 0}
            leftIcon={<RotateCcw size={16} />}
          >
            Issue Debit Note ({formatINR(computedSummary.refundAmount)})
          </Button>
        </div>
      </div>
    </Modal>
  )
}
