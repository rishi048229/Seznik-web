import { useState, useRef, useEffect, Fragment } from 'react'
import { PrinterAnimationModal } from '@/components/ui/PrinterAnimationModal'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useCart } from '@/hooks/useCart'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useCreateSale } from '@/hooks/useSales'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { QuickAddCustomerModal } from '@/components/common/QuickAddCustomerModal'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Wallet, Smartphone, UserPlus, Barcode, Filter, Printer, FileText, ScanLine, Bluetooth, Video, X, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt } from '@/utils/receipt'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { getTopLevelCategories, getChildCategories } from '@/utils/categoryTree'
import toast from 'react-hot-toast'
import type { Product } from '@/types/product.types'
import type { Sale } from '@/types/sale.types'

export const POSPage = () => {
  const pageTutorial = usePageTutorial('pos')
  const navigate = useNavigate()
  const { data: products, isLoading } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: settings } = useSettings()
  const { items, addItem, removeItem, updateQty, clearCart, totals } = useCart()
  const { mutate: createSale, isPending: isCreating } = useCreateSale()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const [isScanMode, setIsScanMode] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const blePrinter = useBlePrinter()

  // Product filter panel — stock status, price range, sort.
  type StockFilter = 'all' | 'in' | 'low' | 'out'
  type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc'
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const filterPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isFilterOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFilterOpen])

  const hasActiveFilters = stockFilter !== 'all' || priceMin !== '' || priceMax !== '' || sortBy !== 'name-asc'
  const clearFilters = () => {
    setStockFilter('all')
    setPriceMin('')
    setPriceMax('')
    setSortBy('name-asc')
  }
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percent'>('flat')
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [completedSaleId, setCompletedSaleId] = useState<string>('')
  const [completedInvoiceNumber, setCompletedInvoiceNumber] = useState<string>('')
  const [lastSaleData, setLastSaleData] = useState<{
    items: typeof items
    totals: typeof totals
    orderDiscountAmount: number
    finalTotal: number
    method: typeof method
    amountPaidNum: number
    selectedCustomer: string
  } | null>(null)

  // Build a map of product stock reserved in cart
  const cartReserved = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.productId] = item.quantity
    return acc
  }, {})

  // Barcode scanner integration
  const handleBarcodeScan = (barcode: string) => {
    const product = products?.find(p => p.barcode === barcode && p.isActive !== false)
    if (product) {
      addItem(product)
      toast.success(`${product.name} added`)
    } else {
      toast.error(`Product not found: ${barcode}`)
    }
  }

  useBarcodeScanner({
    mode: 'pos',
    onScan: handleBarcodeScan,
    enabled: !isPaymentOpen && !isPrintModalOpen && !isScanMode,
  })

  const toggleScanMode = () => {
    setIsScanMode(prev => {
      if (!prev) setTimeout(() => scanInputRef.current?.focus(), 50)
      return !prev
    })
    setScanInput('')
  }

  const handleScanSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const code = scanInput.trim()
    if (code.length >= 4) handleBarcodeScan(code)
    setScanInput('')
  }

  const activeProducts = products?.filter(p => p.isActive !== false) ?? []
  const priceMinNum = parseFloat(priceMin)
  const priceMaxNum = parseFloat(priceMax)
  const filtered = activeProducts
    .filter(p => {
      const q = search.trim().toLowerCase()
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        String(p.sellingPrice).includes(q)
      const matchesCategory = !selectedCategory || p.categoryId === selectedCategory

      const reserved = cartReserved[p.id] || 0
      const available = p.currentStock - reserved
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'out' && available <= 0) ||
        (stockFilter === 'low' && available > 0 && available <= p.lowStockThreshold) ||
        (stockFilter === 'in' && available > p.lowStockThreshold)

      const matchesPriceMin = isNaN(priceMinNum) || p.sellingPrice >= priceMinNum
      const matchesPriceMax = isNaN(priceMaxNum) || p.sellingPrice <= priceMaxNum

      return matchesSearch && matchesCategory && matchesStock && matchesPriceMin && matchesPriceMax
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name)
        case 'name-desc': return b.name.localeCompare(a.name)
        case 'price-asc': return a.sellingPrice - b.sellingPrice
        case 'price-desc': return b.sellingPrice - a.sellingPrice
        case 'stock-asc': return a.currentStock - b.currentStock
        case 'stock-desc': return b.currentStock - a.currentStock
        default: return 0
      }
    })

  const orderDiscountAmount = orderDiscountType === 'flat'
    ? orderDiscount
    : totals.subtotal * (orderDiscount / 100)

  const taxAmount = totals.tax
  const finalTotal = totals.subtotal + taxAmount - orderDiscountAmount

  const handleProductClick = (product: Product) => {
    const reserved = cartReserved[product.id] || 0
    const available = product.currentStock - reserved
    if (available <= 0) {
      toast.error('Out of stock')
    } else {
      addItem(product)
    }
  }

  const handleUpdateQty = (productId: string, newQty: number) => {
    const product = products?.find(p => p.id === productId)
    if (!product) return
    const reserved = cartReserved[productId] || 0
    const otherQty = reserved - (items.find(i => i.productId === productId)?.quantity || 0)
    const maxAllowed = product.currentStock - otherQty

    if (newQty > maxAllowed) {
      toast.error(`Only ${maxAllowed} available in stock`)
      return
    }
    if (newQty <= 0) {
      removeItem(productId)
    } else {
      updateQty(productId, newQty)
    }
  }

  const amountPaidNum = parseFloat(amountPaid) || 0
  const change = amountPaidNum - finalTotal
  const isComplete = method === 'cash' ? amountPaidNum >= finalTotal : true

  const handleCheckout = () => {
    const saleData: Parameters<typeof createSale>[0] = {
      items: items.map(item => {
        const itemTaxRate = item.taxRate || 0
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          discount: item.discount,
          taxRate: itemTaxRate,
          taxAmount: ((item.sellingPrice * item.quantity - item.discount) * itemTaxRate / 100),
          total: item.sellingPrice * item.quantity - item.discount,
        }
      }),
      subtotal: totals.subtotal,
      totalDiscount: orderDiscountAmount + items.reduce((s, i) => s + i.discount, 0),
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: method === 'cash' ? amountPaidNum : method === 'credit' ? 0 : finalTotal,
      changeReturned: method === 'cash' ? change : 0,
      isQuickBill: false,
    }

    // Only set customerId if a customer is selected (Firestore rejects undefined)
    if (selectedCustomer) {
      saleData.customerId = selectedCustomer
    }

    createSale(saleData, {
      onSuccess: (result) => {
        const saleId = result.id
        const invoiceNumber = result.invoiceNumber
        setLastSaleData({
          items: [...items],
          totals: { ...totals, tax: taxAmount },
          orderDiscountAmount,
          finalTotal,
          method,
          amountPaidNum: method === 'cash' ? amountPaidNum : finalTotal,
          selectedCustomer,
        })
        setCompletedSaleId(saleId)
        setCompletedInvoiceNumber(invoiceNumber)
        clearCart()
        setOrderDiscount(0)
        setSelectedCustomer('')
        setIsPaymentOpen(false)
        setIsPrintModalOpen(true)
        toast.success('Sale completed!')
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : 'Failed to create sale'
        console.error('Sale creation failed:', error)
        toast.error(msg)
      },
    })
  }

  // Build sale object from lastSaleData (cart items are already cleared)
  const buildTempSale = (): Sale | null => {
    if (!lastSaleData) return null
    return {
      id: completedSaleId,
      invoiceNumber: completedInvoiceNumber || `INV-${completedSaleId?.slice(-5) || '00000'}`,
      items: lastSaleData.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        taxAmount: ((item.sellingPrice * item.quantity - item.discount) * item.taxRate / 100),
        total: item.sellingPrice * item.quantity - item.discount,
      })),
      subtotal: lastSaleData.totals.subtotal,
      totalDiscount: lastSaleData.orderDiscountAmount + lastSaleData.items.reduce((s, i) => s + i.discount, 0),
      totalTax: lastSaleData.totals.tax,
      grandTotal: lastSaleData.finalTotal,
      paymentMethod: lastSaleData.method,
      amountPaid: lastSaleData.amountPaidNum,
      changeReturned: lastSaleData.method === 'cash' ? lastSaleData.amountPaidNum - lastSaleData.finalTotal : 0,
      isQuickBill: false,
      createdAt: new Date().toISOString(),

    }
  }

  const finishPrintFlow = () => {
    setIsPrintModalOpen(false)
    setCompletedSaleId('')
    setCompletedInvoiceNumber('')
    setMethod('cash')
    setAmountPaid('')
    navigate(ROUTES.SALES)
  }

  const [isPrintingAnimating, setIsPrintingAnimating] = useState(false)

  // Accept format directly to avoid React state race condition
  const handlePrint = (format: 'a4' | 'thermal') => {
    const tempSale = buildTempSale()
    if (!tempSale || !lastSaleData) return

    setIsPrintingAnimating(true)

    const receiptConfig = settings?.receiptConfig
    const customerName = lastSaleData.selectedCustomer
      ? customers?.find(c => c.id === lastSaleData.selectedCustomer)?.name
      : ''

    const paperSize = settings?.printerConfig?.paperSize || '58mm'
    const paperWidth: '50mm' | '80mm' | '210mm' = format === 'thermal'
      ? (paperSize === '80mm' ? '80mm' : '50mm')
      : '210mm'

    const receiptHTML = generateReceiptHTML({
      sale: tempSale,
      receiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName,
      width: paperWidth,
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
      settingsTaxName: 'GST',
    })

    printReceipt(receiptHTML, paperWidth, tempSale.invoiceNumber, finishPrintFlow)
  }

  const handlePrintBluetooth = async () => {
    const tempSale = buildTempSale()
    if (!tempSale || !lastSaleData) return

    setIsPrintingAnimating(true)
    setIsBlePrinting(true)
    try {
      if (blePrinter.status !== 'connected') {
        await blePrinter.connect()
      }
      const receiptConfig = settings?.receiptConfig
      const customerName = lastSaleData.selectedCustomer
        ? customers?.find(c => c.id === lastSaleData.selectedCustomer)?.name
        : ''
      const bytes = generateReceiptEscPos({
        sale: tempSale,
        receiptConfig,
        paperSize: settings?.printerConfig?.paperSize || '58mm',
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName,
      })
      await blePrinter.print(bytes)
      finishPrintFlow()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to print via Bluetooth'
      toast.error(msg)
    } finally {
      setIsBlePrinting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12"><Spinner size="lg" /></div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100dvh-136px)] lg:h-[calc(100dvh-56px-3rem)] gap-0 -m-3 sm:-m-4 lg:-m-6 min-h-0 overflow-hidden">

      {/* Mobile Tab Switcher */}
      <div className="sm:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <button
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            mobileTab === 'products'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Products
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
            mobileTab === 'cart'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Cart
          {items.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Left: Product List */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${mobileTab === 'cart' ? 'hidden sm:flex' : 'flex'}`}>
        {/* Search & Category Bar */}
        <div data-tour="pos-search-bar" className="px-4 sm:px-6 pt-4 pb-3 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div data-tour="pos-search-input" className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search by product name, SKU, or scan barcode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 pr-4 h-11 text-sm"
              />
            </div>
            <button
              onClick={pageTutorial.openTutorial}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm shrink-0 h-11"
            >
              <Video size={16} className="animate-pulse" />
              <span className="hidden sm:inline">Video Guide</span>
            </button>
            <div ref={filterPanelRef} className="relative flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(v => !v)}
                className={`relative h-11 w-11 p-0 flex items-center justify-center ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
              >
                <Filter size={18} />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-gray-900" />
                )}
              </Button>

              {isFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 sm:hidden"
                    onClick={() => setIsFilterOpen(false)}
                  />
                  <div className="fixed left-4 right-4 max-w-sm mx-auto top-28 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-none bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Filters</h4>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          <X size={12} /> Clear all
                        </button>
                      )}
                    </div>

                    {/* Stock Status */}
                    <div className="mb-4">
                      <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Stock Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'all', label: 'All Stock' },
                          { value: 'in', label: 'In Stock' },
                          { value: 'low', label: 'Low Stock' },
                          { value: 'out', label: 'Out of Stock' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStockFilter(opt.value)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold text-center transition-colors ${
                              stockFilter === opt.value
                                ? 'bg-[#0a0a2e] text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="mb-4">
                      <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Price Range
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={priceMin}
                          onChange={e => setPriceMin(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={priceMax}
                          onChange={e => setPriceMax(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Sort By */}
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        <ArrowUpDown size={12} /> Sort By
                      </label>
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as SortOption)}
                        className="w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="name-asc">Name (A–Z)</option>
                        <option value="name-desc">Name (Z–A)</option>
                        <option value="price-asc">Price (Low to High)</option>
                        <option value="price-desc">Price (High to Low)</option>
                        <option value="stock-asc">Stock (Low to High)</option>
                        <option value="stock-desc">Stock (High to Low)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={toggleScanMode}
              className={`h-11 flex items-center gap-2 px-4 rounded-xl border-2 text-sm font-medium whitespace-nowrap transition-all ${
                isScanMode
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
              }`}
            >
              {isScanMode ? <ScanLine size={16} className="animate-pulse" /> : <Barcode size={16} />}
              {isScanMode ? 'Scanning...' : 'Scan Barcode'}
            </button>
          </div>

          {/* Barcode Scan Input Panel */}
          {isScanMode && (
            <div className="mt-3 p-4 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-sm">
                <ScanLine size={18} className="animate-pulse" />
                Scan mode active — point your scanner or type a barcode below
              </div>
              <form onSubmit={handleScanSubmit} className="flex gap-2">
                <Input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="Scan or type barcode, then press Enter..."
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" disabled={scanInput.trim().length < 4}>
                  Add
                </Button>
                <Button type="button" variant="ghost" onClick={toggleScanMode}>
                  Done
                </Button>
              </form>
            </div>
          )}

          {/* Category Tabs */}
          <div data-tour="pos-category-tabs" className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-[#0a0a2e] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
              }`}
            >
              All Products
            </button>
            {getTopLevelCategories(categories).map(parent => (
              <Fragment key={parent.id}>
                <button
                  onClick={() => setSelectedCategory(parent.id)}
                  className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === parent.id
                      ? 'bg-[#0a0a2e] text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  {parent.name}
                </button>
                {getChildCategories(categories, parent.id).map(child => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedCategory(child.id)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === child.id
                        ? 'bg-[#0a0a2e] text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    › {child.name}
                  </button>
                ))}
              </Fragment>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div data-tour="pos-product-grid" className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(product => {
              const reserved = cartReserved[product.id] || 0
              const available = product.currentStock - reserved
              const isOutOfStock = available <= 0
              const isLowStock = available > 0 && available <= product.lowStockThreshold

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleProductClick(product)}
                  className={`group h-full flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
                      : 'cursor-pointer border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-blue-300 dark:hover:border-blue-800'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    {product.imageURL ? (
                      <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingCart size={18} className="text-gray-300" />
                    )}
                  </div>

                  {/* Name + SKU */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">SKU: {product.sku}</p>
                  </div>

                  {/* Price + stock badge + add */}
                  <div className="mt-auto pt-1 flex items-end justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-bold text-blue-600">
                        {formatINR(product.sellingPrice)}
                      </span>
                      <span className={`inline-flex w-fit text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${available}`}
                      </span>
                    </div>
                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => { e.stopPropagation(); if (!isOutOfStock) handleProductClick(product) }}

                      className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search size={48} className="mb-4 opacity-30" />
              <p className="text-sm">{search ? 'No products match your search' : 'No products available'}</p>
            </div>
          )}
        </div>

        {/* Mobile: View Cart sticky bar */}
        {items.length > 0 && (
          <div className="sm:hidden flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              onClick={() => setMobileTab('cart')}
              className="w-full py-3 bg-[#0a0a2e] text-white rounded-xl font-bold text-sm flex items-center justify-between px-5"
            >
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{items.length} items</span>
              <span>View Cart</span>
              <span className="font-bold">{formatINR(finalTotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Right: Cart Panel */}
      <Card data-tour="pos-cart-panel" className={`sm:w-[400px] w-full flex-shrink-0 flex flex-col h-full min-h-0 max-h-full my-0 sm:my-3 sm:mr-3 sm:ml-0 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden ${mobileTab === 'products' ? 'hidden sm:flex' : 'flex'}`}>
        {/* Cart Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Checkout</h2>
              <Badge variant="info">Order #{String(Date.now()).slice(-4)}</Badge>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setIsPaymentOpen(true)}
                disabled={isCreating}
                title="Complete & Print"
                className="sm:hidden px-3 py-1.5 bg-[#0a0a2e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
            )}
          </div>

          {/* Customer Selector (optional - walk-in by default) */}
          <div data-tour="pos-customer-select" className="relative">
            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(true)}
              title="Add new customer"
              aria-label="Add new customer"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <UserPlus size={16} />
            </button>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full h-9 pl-9 pr-9 rounded-lg appearance-none cursor-pointer bg-gray-50 dark:bg-gray-700/40 border-0 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60"
            >
              <option value="">— Walk-in Customer —</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 space-y-2 min-h-0">
          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs mt-1">Search or scan to add products</p>
            </div>
          ) : (
            items.map(item => {
              const product = products?.find(p => p.id === item.productId)
              const reserved = cartReserved[item.productId] || 0
              const available = (product?.currentStock || 0) - reserved

              return (
                <div key={item.productId} className="group bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700/60 p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                      {item.imageURL ? (
                        <img src={item.imageURL} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ShoppingCart size={18} />
                        </div>
                      )}
                    </div>

                    {/* Product Info - Left */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {item.productName}
                      </h4>
                      <p className="text-xs text-gray-400">{formatINR(item.sellingPrice)} each</p>
                    </div>

                    {/* Delete Button - Right */}
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>

                  {/* Quantity Controls + Line Total - Separate Row */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/70 dark:border-gray-600">
                    <div className="flex items-center bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 px-1 py-0.5 gap-1">
                      <button
                        onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-bold w-8 text-center text-gray-900 dark:text-gray-100">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={item.quantity >= available}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatINR(item.sellingPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Bottom Section: Discount + Totals + Complete & Print Button */}
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 pb-14 sm:pb-4 space-y-2">
          {/* Order Discount (Order-level only) */}
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Discount"
                value={orderDiscount || ''}
                onChange={e => setOrderDiscount(parseFloat(e.target.value) || 0)}
                className="flex-1 h-9 text-xs"
              />
              <div className="relative shrink-0">
                <select
                  value={orderDiscountType}
                  onChange={e => setOrderDiscountType(e.target.value as 'flat' | 'percent')}
                  className="h-9 px-2 pr-7 border border-gray-300 dark:border-gray-600 rounded-lg appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="flat">₹</option>
                  <option value="percent">%</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">Total ({items.length})</p>
                <p className="text-base font-bold text-[#0a0a2e] dark:text-white leading-tight">{formatINR(finalTotal)}</p>
              </div>
            </div>
          )}

          {/* Payment Button */}
          <div data-tour="pos-checkout-btn">
            <Button
              onClick={() => setIsPaymentOpen(true)}
              disabled={items.length === 0 || isCreating}
              className="w-full h-11 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
            >
              <Printer size={18} className="mr-2" />
              Complete & Print
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Complete Payment"
        size="md"
        footer={
          <Button
            onClick={handleCheckout}
            disabled={!isComplete || isCreating}
            loading={isCreating}
            className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            {isComplete ? 'Complete & Print' : 'Insufficient Amount'}
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Total Display */}
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatINR(finalTotal)}</p>
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment Method</label>
            <div className="grid grid-cols-4 gap-3">
              {([
                { id: 'cash' as const, label: 'Cash', icon: Wallet },
                { id: 'card' as const, label: 'Card', icon: CreditCard },
                { id: 'upi' as const, label: 'UPI', icon: Smartphone },
                { id: 'credit' as const, label: 'Credit', icon: UserPlus },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    method === id
                      ? 'border-[#0a0a2e] bg-[#0a0a2e]/5'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon size={24} className={method === id ? 'text-[#0a0a2e]' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${method === id ? 'text-[#0a0a2e]' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Input */}
          {method === 'cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount Received
              </label>
              <Input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="Enter amount"
                className="text-lg"
                autoFocus
              />
              {amountPaidNum > 0 && (
                <div className="mt-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Received</span>
                    <span className="font-medium">{formatINR(amountPaidNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Change</span>
                    <span className={`font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatINR(Math.abs(change))} {change >= 0 ? '(return)' : '(due)'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {[100, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmountPaid(String(amt))}
                    className="flex-1 py-2.5 text-sm font-medium border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
                  >
                    {formatINR(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Print Format Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => { setIsPrintModalOpen(false); }} title="Print Receipt" size="sm">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Select print format for the receipt:</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePrint('a4')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <FileText size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">A4 Paper</p>
                <p className="text-xs text-gray-400">Standard format</p>
              </div>
            </button>
            <button
              onClick={() => handlePrint('thermal')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <Printer size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">50mm Thermal</p>
                <p className="text-xs text-gray-400">POS printer</p>
              </div>
            </button>
          </div>

          {blePrinter.isSupported && (
            <Button
              variant="outline"
              className="w-full"
              loading={isBlePrinting}
              leftIcon={<Bluetooth size={16} />}
              onClick={handlePrintBluetooth}
            >
              {blePrinter.status === 'connected' ? `Print to ${blePrinter.deviceName}` : 'Print via Bluetooth'}
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => { setIsPrintModalOpen(false); }}
            className="w-full"
          >
            Skip Printing
          </Button>
        </div>
      </Modal>

      <PrinterAnimationModal
        isOpen={isPrintingAnimating}
        onClose={() => setIsPrintingAnimating(false)}
        invoiceNumber="INV-RECENT"
        grandTotal={lastSaleData?.finalTotal || lastSaleData?.totals?.grandTotal}
        businessName={settings?.businessName}
        itemCount={lastSaleData?.items?.length}
      />

      <QuickAddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCreated={(customerId) => {
          setSelectedCustomer(customerId)
          setIsAddCustomerOpen(false)
        }}
      />

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="pos"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
