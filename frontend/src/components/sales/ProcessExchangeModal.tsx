import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { Sale } from '@/types/sale.types'
import { getReturnsForSale } from '@/services/saleReturnService'
import { createSaleExchange } from '@/services/saleExchangeService'
import { calculateReturnSummary, type ReturnItemRequest } from '@shared/saleReturnCalculator'
import { calculateGstBill, round2 } from '@shared/gstTaxEngine'
import { useProducts } from '@/hooks/useProducts'
import { formatINR } from '@/utils/currency'
import { ArrowRightLeft, AlertCircle, CheckCircle2, Box, Plus, Trash2, Search, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'

interface ProcessExchangeModalProps {
  sale: Sale
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: any) => void
}

interface NewExchangeItem {
  id: string
  productId?: string
  name: string
  price: number
  quantity: number
  taxRate: number
  priceIncludesGst: boolean
}

export const ProcessExchangeModal = ({
  sale,
  isOpen,
  onClose,
  onSuccess,
}: ProcessExchangeModalProps) => {
  const { data: products = [] } = useProducts()
  const [loadingPastReturns, setLoadingPastReturns] = useState(false)
  const [pastReturns, setPastReturns] = useState<any[]>([])
  
  // Return Selection State (Inward Leg)
  const [returnSelection, setReturnSelection] = useState<
    Record<string, { selected: boolean; quantity: number; restock: boolean }>
  >({})

  // Replacement Items State (Outward Leg)
  const [newItems, setNewItems] = useState<NewExchangeItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Settlement & Metadata
  const [settlementMethod, setSettlementMethod] = useState<string>('cash')
  const [exchangeDiscount, setExchangeDiscount] = useState<string>('')
  const [reason, setReason] = useState<string>('size_fit_change')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch past returns on mount
  useEffect(() => {
    if (!isOpen || !sale?.id) return

    let isMounted = true
    setLoadingPastReturns(true)
    getReturnsForSale(sale.id)
      .then((returns) => {
        if (isMounted) {
          setPastReturns(returns || [])
          const initial: Record<string, { selected: boolean; quantity: number; restock: boolean }> = {}
          const items = Array.isArray(sale.items) ? sale.items : []

          items.forEach((item, index) => {
            const key = item.productId || item.productName || `item-${index}`
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
          setReturnSelection(initial)
        }
      })
      .catch((err) => console.error('Failed to load past returns for exchange', err))
      .finally(() => {
        if (isMounted) setLoadingPastReturns(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, sale?.id])

  // Map remaining quantities per line item
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

  // Inward Leg Return Summary Calculation
  const returnSummary = useMemo(() => {
    const items = Array.isArray(sale.items) ? sale.items : []
    const requests: ReturnItemRequest[] = []

    items.forEach((item, index) => {
      const key = item.productId || item.productName || `item-${index}`
      const state = returnSelection[key]
      if (state && state.selected && state.quantity > 0) {
        requests.push({
          productId: item.productId,
          productName: item.productName,
          quantity: state.quantity,
          restock: state.restock,
        })
      }
    })

    try {
      return calculateReturnSummary(items as any, requests, 0)
    } catch {
      return { items: [], subtotal: 0, totalTax: 0, extraChargesRefunded: 0, refundAmount: 0 }
    }
  }, [sale.items, returnSelection])

  // Outward Leg New Sale Calculation
  const newSaleSummary = useMemo(() => {
    if (newItems.length === 0) {
      return {
        subtotal: 0,
        totalTax: 0,
        grandTotal: 0,
        lineItems: [],
      }
    }

    const billResult = calculateGstBill({
      lineItems: newItems.map((item) => ({
        id: item.productId || item.id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        gstRate: item.taxRate,
        priceType: item.priceIncludesGst ? 'inclusive' : 'exclusive',
      })),
    })

    return {
      subtotal: billResult.totalTaxableValue,
      totalTax: billResult.totalTax,
      grandTotal: billResult.finalInvoiceTotal,
      billResult,
    }
  }, [newItems])

  // Difference Amount & Settlement Calculation (Incorporating explicit goodwill discount)
  const cleanExchangeDiscount = useMemo(() => {
    return Math.max(0, Number(exchangeDiscount) || 0)
  }, [exchangeDiscount])

  const differenceAmount = useMemo(() => {
    return round2(newSaleSummary.grandTotal - returnSummary.refundAmount - cleanExchangeDiscount)
  }, [newSaleSummary.grandTotal, returnSummary.refundAmount, cleanExchangeDiscount])

  const isEven = Math.abs(differenceAmount) < 0.01
  const isUpgrade = differenceAmount > 0
  const isDowngrade = differenceAmount < 0

  // Filter catalog products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [products, searchQuery])

  const handleAddProduct = (product: any) => {
    const existingIndex = newItems.findIndex((i) => i.productId === product.id)
    if (existingIndex >= 0) {
      setNewItems((prev) =>
        prev.map((item, idx) => (idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item))
      )
    } else {
      setNewItems((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}-${Math.random()}`,
          productId: product.id,
          name: product.name,
          price: Number(product.sellingPrice) || 0,
          quantity: 1,
          taxRate: Number(product.taxRate) || 0,
          priceIncludesGst: Boolean(product.priceIncludesGst),
        },
      ])
    }
    setSearchQuery('')
  }

  const handleRemoveNewItem = (id: string) => {
    setNewItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleUpdateNewItemQty = (id: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveNewItem(id)
    } else {
      setNewItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)))
    }
  }

  const handleToggleReturnSelect = (key: string) => {
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: false, quantity: 1, restock: true }
      return { ...prev, [key]: { ...curr, selected: !curr.selected } }
    })
  }

  const handleUpdateReturnQty = (key: string, qty: number, max: number) => {
    const validQty = Math.max(1, Math.min(qty, max))
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true }
      return { ...prev, [key]: { ...curr, quantity: validQty } }
    })
  }

  const handleToggleRestock = (key: string) => {
    setReturnSelection((prev) => {
      const curr = prev[key] || { selected: true, quantity: 1, restock: true }
      return { ...prev, [key]: { ...curr, restock: !curr.restock } }
    })
  }

  const handleSubmitExchange = async () => {
    if (returnSummary.items.length === 0) {
      toast.error('Select at least one item to return')
      return
    }

    if (newItems.length === 0) {
      toast.error('Add at least one replacement item for the customer')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        originalSaleId: sale.id,
        returnedItems: returnSummary.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          restock: i.restock,
        })),
        newItems: newItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          sellingPrice: i.price,
          taxRate: i.taxRate,
          priceIncludesGst: i.priceIncludesGst,
          total: i.price * i.quantity,
        })),
        newSubtotal: newSaleSummary.subtotal,
        newTotalDiscount: 0,
        newTotalTax: newSaleSummary.totalTax,
        newGrandTotal: newSaleSummary.grandTotal,
        differenceAmount,
        exchangeDiscount: cleanExchangeDiscount,
        settlementMethod: isEven ? 'even_exchange' : settlementMethod,
        reason,
        notes,
      }

      const res = await createSaleExchange(sale.id, payload)
      toast.success(`Exchange ${res.exchange.exchangeNumber} processed successfully!`)
      onSuccess(res)
    } catch (err) {
      toastError(err, 'Failed to process exchange')
    } finally {
      setIsSubmitting(false)
    }
  }

  const originalItems = Array.isArray(sale.items) ? sale.items : []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Product Exchange" size="xl">
      {loadingPastReturns ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Checking invoice history...</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[75vh] overflow-y-auto px-1 pr-2">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-500">Invoice:</span> <strong>#{sale.invoiceNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500">Customer:</span>{' '}
              <strong>{sale.customerName || (sale as any).customer?.name || 'Walk-in'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Original Total:</span> <strong>{formatINR(sale.grandTotal)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Return Leg (Inward) */}
            <div className="space-y-3 p-4 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Box className="text-rose-500" size={16} /> 1. Return Items (Inward)
                </h3>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Credit: {formatINR(returnSummary.refundAmount)}
                </span>
              </div>

              <div className="space-y-2.5">
                {originalItems.map((item, index) => {
                  const key = item.productId || item.productName || `item-${index}`
                  const remaining = itemRemainingMap.get(key) ?? (Number(item.quantity) || 1)
                  const isExhausted = remaining <= 0
                  const state = returnSelection[key] || { selected: false, quantity: 1, restock: true }

                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-lg border transition-all text-xs ${
                        isExhausted
                          ? 'opacity-50 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          : state.selected
                          ? 'bg-white dark:bg-slate-800 border-rose-300 dark:border-rose-700 shadow-sm'
                          : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            disabled={isExhausted}
                            checked={state.selected && !isExhausted}
                            onChange={() => handleToggleReturnSelect(key)}
                            className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.productName || item.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Billed: {item.quantity} | Available: <strong>{remaining}</strong> | Price: {formatINR(item.sellingPrice || item.unitPrice || 0)}
                            </p>
                          </div>
                        </label>
                      </div>

                      {state.selected && !isExhausted && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-[11px]">Return Qty:</span>
                            <input
                              type="number"
                              min={1}
                              max={remaining}
                              value={state.quantity}
                              onChange={(e) => handleUpdateReturnQty(key, parseInt(e.target.value) || 1, remaining)}
                              className="w-14 px-1.5 py-1 text-xs border rounded bg-white dark:bg-slate-900 text-center font-bold"
                            />
                          </div>
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={state.restock}
                              onChange={() => handleToggleRestock(key)}
                              className="rounded border-slate-300 text-emerald-600"
                            />
                            <span>Restock Item</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. Replacement Leg (Outward) */}
            <div className="space-y-3 p-4 bg-sky-50/40 dark:bg-sky-950/20 rounded-xl border border-sky-200/60 dark:border-sky-900/40">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="text-sky-500" size={16} /> 2. Replacement Items (Outward)
                </h3>
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Total: {formatINR(newSaleSummary.grandTotal)}
                </span>
              </div>

              {/* Product Search */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search product from catalog to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {filteredProducts.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="w-full px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                          <p className="text-[10px] text-slate-400">Stock: {p.currentStock} {p.unit}</p>
                        </div>
                        <span className="font-bold text-sky-600 dark:text-sky-400">{formatINR(p.sellingPrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Replacement Items List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {newItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs border border-dashed rounded-lg">
                    Search and pick replacement products above
                  </div>
                ) : (
                  newItems.map((item) => {
                    const calcLine = newSaleSummary.billResult?.lines?.find(
                      (l) => l.id === (item.productId || item.id)
                    )
                    const lineFinal = calcLine ? calcLine.lineFinalAmount : (item.price * item.quantity)
                    const hasTax = item.taxRate > 0

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                            {hasTax && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  item.priceIncludesGst
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {item.priceIncludesGst ? `Incl. ${item.taxRate}% GST` : `+${item.taxRate}% GST`}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatINR(item.price)} × {item.quantity} = <strong className="text-slate-700 dark:text-slate-200">{formatINR(lineFinal)}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleUpdateNewItemQty(item.id, parseInt(e.target.value) || 1)}
                            className="w-12 px-1 py-1 text-xs border rounded bg-white dark:bg-slate-900 text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewItem(item.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. Settlement Breakdown Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Exchange Settlement</span>
              {isEven ? (
                <Badge variant="secondary">Even Exchange (0.00)</Badge>
              ) : isUpgrade ? (
                <Badge variant="primary">Customer Pays Upgrade</Badge>
              ) : (
                <Badge variant="success">Store Refunds Balance</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                <span className="text-slate-400">New Items Total</span>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatINR(newSaleSummary.grandTotal)}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                <span className="text-slate-400">Return Credit</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  -{formatINR(returnSummary.refundAmount)}
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${isUpgrade ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-200' : isDowngrade ? 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-200' : 'bg-white dark:bg-slate-900'}`}>
                <span className="text-slate-500 font-medium">
                  {isEven ? 'Net Difference' : isUpgrade ? 'Customer Pays' : 'Store Refunds'}
                </span>
                <p className={`text-base font-extrabold mt-0.5 ${isUpgrade ? 'text-blue-600 dark:text-blue-400' : isDowngrade ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900'}`}>
                  {formatINR(Math.abs(differenceAmount))}
                </p>
              </div>
            </div>

            {/* Exchange Adjustment / Goodwill Discount Input */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Exchange Adjustment / Goodwill Discount (₹)
                </span>
                <p className="text-[11px] text-slate-400">Absorb small price gaps or offer customer courtesy discount</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0.00"
                  value={exchangeDiscount}
                  onChange={(e) => setExchangeDiscount(e.target.value)}
                  className="w-24 px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 font-bold text-right text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            {/* Payment / Refund Method (if not even) */}
            {!isEven && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isUpgrade ? 'Collect Payment Via:' : 'Refund Amount Via:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(['cash', 'upi', 'card', 'store_credit', 'credit_ledger'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSettlementMethod(method)}
                      className={`px-3 py-1.5 rounded-lg border font-medium uppercase text-[11px] transition-all ${
                        settlementMethod === method
                          ? 'bg-[#0a0a2e] text-white border-[#0a0a2e] dark:bg-blue-600 dark:border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {method.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Exchange Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="size_fit_change">Size / Fit / Color Swap</option>
                  <option value="defective">Defective / Damaged Item</option>
                  <option value="customer_preference">Customer Choice / Upgrade</option>
                  <option value="wrong_item">Wrong Item Delivered</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Exchange Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Size M replaced with Size L"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                </input>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitExchange}
              isLoading={isSubmitting}
              disabled={returnSummary.items.length === 0 || newItems.length === 0}
              className="flex items-center gap-2"
            >
              <ArrowRightLeft size={16} /> Confirm Exchange
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
