import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { QuickAddProductModal } from '@/components/common/QuickAddProductModal'
import { useProducts } from '@/hooks/useProducts'
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers'
import { useCreatePurchase } from '@/hooks/usePurchases'
import { formatINR } from '@/utils/currency'
import { round2 } from '@shared/gstTaxEngine'
import {
  Plus,
  PlusCircle,
  Trash2,
  Truck,
  Search,
  Calendar,
  CreditCard,
  Building2,
  Receipt,
  Sparkles,
  Barcode,
  Package,
  CheckCircle2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product } from '@/types/product.types'
import { useLanguage } from '@/contexts/LanguageContext'

export interface RecordPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface PurchaseItemRow {
  productId: string
  productName: string
  sku: string
  quantity: number
  costPrice: number
  taxRate: number
  priceIncludesGst: boolean
}

export const RecordPurchaseModal = ({
  isOpen,
  onClose,
  onSuccess,
}: RecordPurchaseModalProps) => {
  const { t } = useLanguage()
  const { data: products } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { mutate: createPurchase, isPending } = useCreatePurchase()
  const { mutate: createSupplierMutation, isPending: isCreatingSupplier } = useCreateSupplier()

  // Form State
  const [supplierId, setSupplierId] = useState('')
  const [supplierBillNumber, setSupplierBillNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'credit'>('full')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'upi' | 'cheque' | 'credit'>('cash')
  const [partialAmount, setPartialAmount] = useState('')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItemRow[]>([])

  // Product Quick-Entry State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quickQty, setQuickQty] = useState('1')
  const [quickCost, setQuickCost] = useState('')
  const [quickTaxRate, setQuickTaxRate] = useState('0')
  const [quickPriceIncludesGst, setQuickPriceIncludesGst] = useState(false)

  // Sub-Modals
  const [isQuickAddProductOpen, setIsQuickAddProductOpen] = useState(false)
  const [isQuickAddSupplierOpen, setIsQuickAddSupplierOpen] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [newSupplierGstin, setNewSupplierGstin] = useState('')

  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter products by search query (name, sku, or barcode)
  const filteredProducts = useMemo(() => {
    if (!products) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products.filter(p => p.isActive).slice(0, 10)
    return products
      .filter(p => p.isActive && (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      ))
      .slice(0, 15)
  }, [products, searchQuery])

  // Select a product from search
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setSearchQuery(product.name)
    setQuickCost(String(product.costPrice || '0'))
    setQuickTaxRate(String(product.taxRate || '0'))
    setQuickPriceIncludesGst(Boolean(product.priceIncludesGst))
    setIsSearchDropdownOpen(false)
  }

  // Add line item to list
  const handleAddItem = () => {
    if (!selectedProduct) {
      toast.error('Please select a product first')
      return
    }

    const qty = parseFloat(quickQty) || 1
    const cost = parseFloat(quickCost) >= 0 ? parseFloat(quickCost) : (selectedProduct.costPrice || 0)
    const tax = parseFloat(quickTaxRate) >= 0 ? parseFloat(quickTaxRate) : (selectedProduct.taxRate || 0)

    if (qty <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.productId === selectedProduct.id)
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + qty,
          costPrice: cost,
          taxRate: tax,
          priceIncludesGst: quickPriceIncludesGst,
        }
        return updated
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: selectedProduct.sku || '',
          quantity: qty,
          costPrice: cost,
          taxRate: tax,
          priceIncludesGst: quickPriceIncludesGst,
        },
      ]
    })

    // Reset entry bar
    setSelectedProduct(null)
    setSearchQuery('')
    setQuickQty('1')
    setQuickCost('')
    setQuickTaxRate('0')
    setQuickPriceIncludesGst(false)
  }

  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const handleUpdateItem = (productId: string, field: keyof PurchaseItemRow, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  // Line calculations & Totals
  const calculatedRows = useMemo(() => {
    return items.map(item => {
      const gross = item.costPrice * item.quantity
      let taxable = gross
      let tax = 0

      if (item.taxRate > 0) {
        if (item.priceIncludesGst) {
          taxable = round2(gross / (1 + item.taxRate / 100))
          tax = round2(gross - taxable)
        } else {
          taxable = round2(gross)
          tax = round2(taxable * (item.taxRate / 100))
        }
      }

      const lineTotal = round2(taxable + tax)
      return {
        ...item,
        taxable,
        tax,
        lineTotal,
      }
    })
  }, [items])

  const subtotal = useMemo(() => {
    return round2(calculatedRows.reduce((sum, r) => sum + r.taxable, 0))
  }, [calculatedRows])

  const totalTax = useMemo(() => {
    return round2(calculatedRows.reduce((sum, r) => sum + r.tax, 0))
  }, [calculatedRows])

  const grandTotal = useMemo(() => {
    return round2(subtotal + totalTax)
  }, [subtotal, totalTax])

  const amountPaid = useMemo(() => {
    if (paymentMode === 'full') return grandTotal
    if (paymentMode === 'credit') return 0
    const p = parseFloat(partialAmount) || 0
    return round2(Math.max(0, Math.min(p, grandTotal)))
  }, [paymentMode, partialAmount, grandTotal])

  const balancePayable = useMemo(() => {
    return round2(Math.max(0, grandTotal - amountPaid))
  }, [grandTotal, amountPaid])

  const setDueDateOffset = (days: number) => {
    const base = purchaseDate ? new Date(purchaseDate) : new Date()
    base.setDate(base.getDate() + days)
    setPaymentDueDate(base.toISOString().split('T')[0])
  }

  const selectedSupplier = useMemo(() => {
    return suppliers?.find(s => s.id === supplierId) || null
  }, [suppliers, supplierId])

  const handleQuickCreateSupplier = () => {
    if (!newSupplierName.trim() || !newSupplierPhone.trim()) {
      toast.error('Supplier name and phone are required')
      return
    }

    createSupplierMutation(
      {
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim(),
        gstin: newSupplierGstin.trim() || undefined,
      },
      {
        onSuccess: (created: any) => {
          toast.success('Supplier added!')
          if (created?.id) {
            setSupplierId(created.id)
          }
          setIsQuickAddSupplierOpen(false)
          setNewSupplierName('')
          setNewSupplierPhone('')
          setNewSupplierGstin('')
        },
        onError: () => toast.error('Failed to create supplier'),
      }
    )
  }

  const handleSave = () => {
    if (!supplierId) {
      toast.error('Please select or add a supplier')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one product item')
      return
    }

    const payload = {
      supplierId,
      supplierBillNumber: supplierBillNumber.trim() || undefined,
      items: calculatedRows.map(r => ({
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        quantity: r.quantity,
        costPrice: r.costPrice,
        taxRate: r.taxRate,
        taxableAmount: r.taxable,
        taxAmount: r.tax,
        priceIncludesGst: r.priceIncludesGst,
        total: r.lineTotal,
      })),
      subtotal,
      totalTax,
      grandTotal,
      paymentMethod: paymentMode === 'credit' ? 'credit' : paymentMethod,
      amountPaid,
      paymentDueDate: balancePayable > 0 && paymentDueDate ? new Date(paymentDueDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
      createdAt: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
    }

    createPurchase(payload, {
      onSuccess: () => {
        toast.success('Purchase recorded successfully!')
        handleClose()
        onSuccess?.()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to record purchase')
      },
    })
  }

  const handleClose = () => {
    setSupplierId('')
    setSupplierBillNumber('')
    setItems([])
    setSelectedProduct(null)
    setSearchQuery('')
    setPaymentMode('full')
    setPartialAmount('')
    setPaymentDueDate('')
    setNotes('')
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Record Inward Stock Purchase"
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Subtotal (Pre-tax)</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatINR(subtotal)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">GST / Input Tax</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatINR(totalTax)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div>
                <span className="text-xs text-blue-600 dark:text-blue-400 block font-bold uppercase tracking-wider">
                  Total Bill
                </span>
                <span className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatINR(grandTotal)}</span>
              </div>
              {balancePayable > 0 && (
                <>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                  <div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 block font-bold uppercase tracking-wider">
                      Added to Supplier Due
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400">+{formatINR(balancePayable)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={isPending}
                disabled={!supplierId || items.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
              >
                Record Purchase ({formatINR(grandTotal)})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Section 1: Supplier & Bill Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier Selector */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600 dark:text-blue-400" />
                  Supplier *
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickAddSupplierOpen(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Plus size={12} /> New Supplier
                </button>
              </div>
              <Select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                options={[
                  { value: '', label: '-- Select Supplier --' },
                  ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
                ]}
              />
              {selectedSupplier && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 space-y-0.5">
                  {selectedSupplier.phone && <p>📞 {selectedSupplier.phone}</p>}
                  {selectedSupplier.gstin && <p>📑 GSTIN: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedSupplier.gstin}</span></p>}
                  {typeof selectedSupplier.payableBalance === 'number' && selectedSupplier.payableBalance > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 font-semibold">
                      Current Payable Balance: {formatINR(selectedSupplier.payableBalance)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Invoice & Date Details */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={14} className="text-blue-600 dark:text-blue-400" />
                Supplier Bill / Invoice #
              </label>
              <Input
                type="text"
                placeholder="e.g. INV-2026-941"
                value={supplierBillNumber}
                onChange={e => setSupplierBillNumber(e.target.value)}
              />
              <div className="flex items-center gap-2 pt-0.5">
                <Calendar size={13} className="text-slate-400" />
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Mode & Terms */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={14} className="text-blue-600 dark:text-blue-400" />
                Payment Terms
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-center">
                <button
                  type="button"
                  onClick={() => setPaymentMode('full')}
                  className={`py-1 rounded-md transition-all ${paymentMode === 'full' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                >
                  Full Paid
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('partial')}
                  className={`py-1 rounded-md transition-all ${paymentMode === 'partial' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('credit')}
                  className={`py-1 rounded-md transition-all ${paymentMode === 'credit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                >
                  Pay Later
                </button>
              </div>

              {paymentMode !== 'credit' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <Select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as any)}
                      options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'bank', label: 'Bank / NEFT / RTGS' },
                        { value: 'upi', label: 'UPI / QR' },
                        { value: 'cheque', label: 'Cheque' },
                      ]}
                    />
                    {paymentMode === 'partial' && (
                      <Input
                        type="number"
                        placeholder="Amount Paid"
                        value={partialAmount}
                        onChange={e => setPartialAmount(e.target.value)}
                        className="w-28 text-xs font-bold"
                      />
                    )}
                  </div>
                </div>
              )}

              {balancePayable > 0 && (
                <div className="pt-1.5 space-y-1 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Payment Due Date:</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setDueDateOffset(7)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-blue-100">+7d</button>
                      <button type="button" onClick={() => setDueDateOffset(15)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-blue-100">+15d</button>
                      <button type="button" onClick={() => setDueDateOffset(30)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-blue-100">+30d</button>
                      <button type="button" onClick={() => setDueDateOffset(45)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-blue-100">+45d</button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={paymentDueDate}
                    onChange={e => setPaymentDueDate(e.target.value)}
                    className="w-full text-xs p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Fast Product Search & Add Bar */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} className="text-blue-600 dark:text-blue-400" />
                Add Products to Purchase
              </label>
              <button
                type="button"
                onClick={() => setIsQuickAddProductOpen(true)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
              >
                <Plus size={13} />
                <span>+ Create New Product</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              {/* Searchable Combobox */}
              <div className="md:col-span-4 relative" ref={searchContainerRef}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Name / SKU / Barcode
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search product..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setIsSearchDropdownOpen(true)
                    }}
                    onFocus={() => setIsSearchDropdownOpen(true)}
                    className="pl-8 text-sm"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedProduct(null)
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {isSearchDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="p-2.5 hover:bg-blue-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                            <p className="text-slate-400 font-mono text-[11px]">{p.sku ? `SKU: ${p.sku}` : ''} {p.barcode ? `• Barcode: ${p.barcode}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{formatINR(p.costPrice || 0)}</span>
                            <span className="text-[10px] text-slate-400 block">{p.taxRate || 0}% GST</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No matching products found.
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchDropdownOpen(false)
                            setIsQuickAddProductOpen(true)
                          }}
                          className="block mx-auto mt-1 text-blue-600 font-semibold underline"
                        >
                          + Create "{searchQuery}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Unit Cost Price */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Unit Cost (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickCost}
                  onChange={e => setQuickCost(e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
              </div>

              {/* Tax Rate % */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  GST Rate
                </label>
                <Select
                  value={quickTaxRate}
                  onChange={e => setQuickTaxRate(e.target.value)}
                  options={[
                    { value: '0', label: '0% (Exempt)' },
                    { value: '5', label: '5% GST' },
                    { value: '12', label: '12% GST' },
                    { value: '18', label: '18% GST' },
                    { value: '28', label: '28% GST' },
                  ]}
                />
              </div>

              {/* Quantity */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  value={quickQty}
                  onChange={e => setQuickQty(e.target.value)}
                  placeholder="1"
                  className="text-sm text-center"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                />
              </div>

              {/* Add Button */}
              <div className="md:col-span-2">
                <Button
                  onClick={handleAddItem}
                  disabled={!selectedProduct}
                  className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold flex items-center justify-center gap-1"
                >
                  <PlusCircle size={15} />
                  Add Line
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Purchase Items ({items.length})
              </span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {items.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-center w-28">Unit Cost (₹)</th>
                      <th className="py-2.5 px-3 text-center w-24">GST %</th>
                      <th className="py-2.5 px-3 text-center w-24">Qty</th>
                      <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {calculatedRows.map((row, idx) => (
                      <tr key={row.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{row.productName}</p>
                          {row.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {row.sku}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.costPrice}
                            onChange={e => handleUpdateItem(row.productId, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-1 text-xs text-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          <select
                            value={row.taxRate}
                            onChange={e => handleUpdateItem(row.productId, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="px-1.5 py-1 text-xs text-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={e => handleUpdateItem(row.productId, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-16 px-1.5 py-1 text-xs text-center font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-500 dark:text-slate-400">
                          {formatINR(row.tax)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatINR(row.lineTotal)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(row.productId)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
                <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No items added to this purchase yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Use the search bar above to look up products or scan barcode</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={isQuickAddProductOpen}
        onClose={() => setIsQuickAddProductOpen(false)}
        defaultSupplierId={supplierId}
        onProductCreated={(newProd) => {
          handleSelectProduct(newProd)
        }}
      />

      {/* Quick Add Supplier Modal */}
      <Modal
        isOpen={isQuickAddSupplierOpen}
        onClose={() => setIsQuickAddSupplierOpen(false)}
        title="Add New Supplier"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setIsQuickAddSupplierOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickCreateSupplier} loading={isCreatingSupplier}>
              Save Supplier
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Supplier Name *
            </label>
            <Input
              type="text"
              placeholder="e.g. Metro Wholesalers Pvt Ltd"
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone *
            </label>
            <Input
              type="tel"
              placeholder="e.g. 9876543210"
              value={newSupplierPhone}
              onChange={e => setNewSupplierPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GSTIN (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={newSupplierGstin}
              onChange={e => setNewSupplierGstin(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
