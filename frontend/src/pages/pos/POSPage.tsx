import { useState, useRef } from 'react'
import { PrinterAnimationModal } from '@/components/ui/PrinterAnimationModal'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useCart } from '@/hooks/useCart'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useCreateSale } from '@/hooks/useSales'
import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Wallet, Smartphone, UserPlus, Barcode, Filter, Printer, FileText, ScanLine, Bluetooth } from 'lucide-react'
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
import toast from 'react-hot-toast'
import type { Product } from '@/types/product.types'
import type { Sale } from '@/types/sale.types'

export const POSPage = () => {
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
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const [isScanMode, setIsScanMode] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const blePrinter = useBlePrinter()
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
  const filtered = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = !selectedCategory || p.categoryId === selectedCategory
    return matchesSearch && matchesCategory
  })

  const orderDiscountAmount = orderDiscountType === 'flat'
    ? orderDiscount
    : totals.subtotal * (orderDiscount / 100)

  const taxAmount = totals.tax
  const finalTotal = totals.subtotal + taxAmount - orderDiscountAmount
  const uniqueTaxRates = Array.from(new Set(items.map(item => item.taxRate || 0).filter(rate => rate > 0)))
  const taxLabel = uniqueTaxRates.length === 0
    ? 'GST'
    : uniqueTaxRates.length === 1
      ? `GST (${uniqueTaxRates[0]}%)`
      : 'GST (Item-wise)'

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
      amountPaid: method === 'cash' ? amountPaidNum : finalTotal,
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
      createdAt: new Date() as any,
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

    const paperWidth: '50mm' | '210mm' = format === 'thermal' ? '50mm' : '210mm'

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
    <div className="flex flex-col sm:flex-row h-[calc(100dvh-56px)] gap-0 -m-3 sm:-m-4 lg:-m-6">

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
        <div className="px-6 pt-4 pb-3 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Search by product name, SKU, or scan barcode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-12 py-3 text-base"
              />
            </div>
            <Button variant="outline" size="sm" className="p-3">
              <Filter size={18} />
            </Button>
            <button
              type="button"
              onClick={toggleScanMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
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
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
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
            {categories?.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#0a0a2e] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(product => {
              const reserved = cartReserved[product.id] || 0
              const available = product.currentStock - reserved
              const isOutOfStock = available <= 0
              const isLowStock = available > 0 && available <= product.lowStockThreshold

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleProductClick(product)}
                  className={`flex items-center gap-3 sm:gap-4 py-3 sm:py-3 px-2 sm:px-0 transition-colors group ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    {product.imageURL ? (
                      <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingCart size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      <span className="hidden sm:inline">SKU: {product.sku} · </span>
                      <span className={isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : ''}>
                        {isOutOfStock ? 'Out of stock' : `Stock: ${available}`}
                      </span>
                    </p>
                  </div>

                  {/* Stock badge */}
                  <span className={`hidden sm:inline text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide flex-shrink-0 ${
                    isOutOfStock
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : isLowStock
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                  }`}>
                    {isOutOfStock ? 'Out of Stock' : `Stock: ${available}`}
                  </span>

                  {/* Price + add */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-blue-600 font-bold text-sm w-20 text-right">
                      {formatINR(product.sellingPrice)}
                    </span>
                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => { e.stopPropagation(); !isOutOfStock && handleProductClick(product) }}
                      className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      <Card className={`sm:w-[400px] w-full flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 rounded-none ${mobileTab === 'products' ? 'hidden sm:flex' : 'flex'}`}>
        {/* Cart Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Checkout</h2>
            <Badge variant="info">Order #{String(Date.now()).slice(-4)}</Badge>
          </div>

          {/* Customer Selector (optional - walk-in by default) */}
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
            >
              <option value="">— Walk-in Customer —</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
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
                <div key={item.productId} className="group bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Product Image */}
                    <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0">
                      {item.imageURL ? (
                        <img src={item.imageURL} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ShoppingCart size={20} />
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
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-600">
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

        {/* Order Discount (Order-level only) */}
        {items.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Discount"
                value={orderDiscount || ''}
                onChange={e => setOrderDiscount(parseFloat(e.target.value) || 0)}
                className="flex-1"
              />
              <div className="relative">
                <select
                  value={orderDiscountType}
                  onChange={e => setOrderDiscountType(e.target.value as 'flat' | 'percent')}
                  className="px-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
                >
                  <option value="flat">₹</option>
                  <option value="percent">%</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal ({items.length} items)</span>
            <span className="text-gray-900 dark:text-gray-100">{formatINR(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              {taxLabel}
            </span>
            <span className="text-gray-900 dark:text-gray-100">{formatINR(taxAmount)}</span>
          </div>
          {orderDiscountAmount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Discount</span>
              <span>-{formatINR(orderDiscountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-900 dark:text-gray-100">Total Amount</span>
            <span className="text-[#0a0a2e]">{formatINR(finalTotal)}</span>
          </div>
        </div>

        {/* Payment Button */}
        <div className="p-6">
          <Button
            onClick={() => setIsPaymentOpen(true)}
            disabled={items.length === 0 || isCreating}
            className="w-full py-4 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            Complete & Print
          </Button>
        </div>
      </Card>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Complete Payment" size="md">
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

          {/* Complete & Print Button */}
          <Button
            onClick={handleCheckout}
            disabled={!isComplete || isCreating}
            loading={isCreating}
            className="w-full py-4 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            {isComplete ? 'Complete & Print' : 'Insufficient Amount'}
          </Button>
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
    </div>
  )
}
