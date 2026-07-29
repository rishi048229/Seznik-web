import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateSale } from '@/hooks/useSales'

import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { useProducts } from '@/hooks/useProducts'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { QuickAddCustomerModal } from '@/components/common/QuickAddCustomerModal'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Wallet, Smartphone, UserPlus, Printer, Barcode, ScanLine, Bluetooth, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt } from '@/utils/receipt'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import toast from 'react-hot-toast'
import type { Sale } from '@/types/sale.types'

interface CartItem {
  id: string
  productName: string
  quantity: number
  sellingPrice: number
  discount: number
  taxRate: number
  total: number
}

export const POSLitePage = () => {
  const pageTutorial = usePageTutorial('pos-lite')
  const navigate = useNavigate()
  const { mutate: createSale, isPending: isCreating } = useCreateSale()
  const { data: customers } = useCustomers()
  const { data: settings } = useSettings()
  const { data: products } = useProducts()

  const scanInputRef = useRef<HTMLInputElement>(null)
  const [isScanMode, setIsScanMode] = useState(false)
  const [scanInput, setScanInput] = useState('')

  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')
  const [items, setItems] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percent'>('flat')
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [completedSaleId, setCompletedSaleId] = useState<string>('')
  const [completedInvoiceNumber, setCompletedInvoiceNumber] = useState<string>('')
  const [lastSaleData, setLastSaleData] = useState<{
    items: CartItem[]
    subtotal: number
    tax: number
    orderDiscountAmount: number
    finalTotal: number
    method: typeof method
    amountPaidNum: number
    selectedCustomer: string
  } | null>(null)

  // GST mode: 'exclusive' = price is base (GST added on top), 'inclusive' = price already includes GST
  const [gstMode, setGstMode] = useState<'exclusive' | 'inclusive'>('exclusive')

  // Manual product entry form
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productQty, setProductQty] = useState('1')
  const [productTaxRate, setProductTaxRate] = useState('0')

  // Barcode scan: look up product from catalog and add directly to cart
  const handleBarcodeScan = (barcode: string) => {
    const product = products?.find(p => p.barcode === barcode && p.isActive !== false)
    if (!product) {
      toast.error(`No product found for barcode: ${barcode}`)
      return
    }
    const existing = items.find(i => i.id === product.id)
    if (existing) {
      setItems(prev => prev.map(i =>
        i.id === product.id
          ? { ...i, quantity: i.quantity + 1, total: i.sellingPrice * (i.quantity + 1) }
          : i
      ))
    } else {
      setItems(prev => [...prev, {
        id: product.id,
        productName: product.name,
        quantity: 1,
        sellingPrice: product.sellingPrice,
        discount: 0,
        taxRate: product.taxRate,
        total: product.sellingPrice,
      }])
    }
    toast.success(`${product.name} added via scan`)
  }

  // Physical USB/Bluetooth barcode scanner — fires when no input is focused
  useBarcodeScanner({
    mode: 'pos',
    onScan: handleBarcodeScan,
    enabled: !isPaymentOpen && !isPrintModalOpen && !isScanMode,
  })

  // Manual scan input submit (for on-screen scan mode or typing a barcode)
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scanInput.trim()
    if (code.length >= 4) handleBarcodeScan(code)
    setScanInput('')
  }

  const toggleScanMode = () => {
    setIsScanMode(prev => {
      if (!prev) setTimeout(() => scanInputRef.current?.focus(), 50)
      return !prev
    })
    setScanInput('')
  }

  const addItem = () => {
    if (!productName.trim()) {
      toast.error('Please enter product name')
      return
    }
    const price = parseFloat(productPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter valid price')
      return
    }
    const qty = parseInt(productQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter valid quantity')
      return
    }
    const taxRate = parseFloat(productTaxRate) || 0
    if (taxRate < 0 || taxRate > 100) {
      toast.error('GST rate must be between 0 and 100')
      return
    }

    // If GST inclusive, back-calculate the base price: basePrice = price / (1 + rate/100)
    const basePrice = gstMode === 'inclusive' && taxRate > 0
      ? price / (1 + taxRate / 100)
      : price

    const newItem: CartItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      productName: productName.trim(),
      quantity: qty,
      sellingPrice: basePrice,
      discount: 0,
      taxRate,
      total: basePrice * qty,
    }

    setItems(prev => [...prev, newItem])
    setProductName('')
    setProductPrice('')
    setProductQty('1')
    setProductTaxRate('0')
    toast.success(`${newItem.productName} added`)
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(id)
    } else {
      setItems(prev =>
        prev.map(i =>
          i.id === id ? { ...i, quantity: newQty, total: i.sellingPrice * newQty } : i
        )
      )
    }
  }

  const clearCart = () => {
    setItems([])
    setOrderDiscount(0)
    setSelectedCustomer('')
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const orderDiscountAmount = orderDiscountType === 'flat'
    ? orderDiscount
    : subtotal * (orderDiscount / 100)

  const taxAmount = items.reduce(
    (sum, item) => sum + ((item.sellingPrice * item.quantity - item.discount) * (item.taxRate || 0) / 100),
    0
  )
  const finalTotal = subtotal + taxAmount - orderDiscountAmount

  const amountPaidNum = parseFloat(amountPaid) || 0
  const change = amountPaidNum - finalTotal
  const isComplete = method === 'cash' ? amountPaidNum >= finalTotal : true

  const handleCheckout = () => {
    const saleData: Parameters<typeof createSale>[0] = {
      items: items.map(item => ({
        productId: '',
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        taxAmount: ((item.sellingPrice * item.quantity - item.discount) * item.taxRate / 100),
        total: item.sellingPrice * item.quantity - item.discount,
      })),
      subtotal,
      totalDiscount: orderDiscountAmount + items.reduce((s, i) => s + i.discount, 0),
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: method === 'cash' ? amountPaidNum : method === 'credit' ? 0 : finalTotal,
      changeReturned: method === 'cash' ? change : 0,
      isQuickBill: false,
    }

    if (selectedCustomer) {
      saleData.customerId = selectedCustomer
    }

    createSale(saleData, {
      onSuccess: (result) => {
        const saleId = result.id
        const invoiceNumber = result.invoiceNumber
        setLastSaleData({
          items: [...items],
          subtotal,
          tax: taxAmount,
          orderDiscountAmount,
          finalTotal,
          method,
          amountPaidNum: method === 'cash' ? amountPaidNum : finalTotal,
          selectedCustomer,
        })
        setCompletedSaleId(saleId)
        setCompletedInvoiceNumber(invoiceNumber)
        clearCart()
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

  const buildTempSale = (): Sale | null => {
    if (!lastSaleData) return null
    return {
      id: completedSaleId,
      invoiceNumber: completedInvoiceNumber || `INV-${completedSaleId?.slice(-5) || '00000'}`,
      items: lastSaleData.items.map(item => ({
        productId: item.id,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        taxAmount: ((item.sellingPrice * item.quantity - item.discount) * item.taxRate / 100),
        total: item.sellingPrice * item.quantity - item.discount,
      })),
      subtotal: lastSaleData.subtotal,
      totalDiscount: lastSaleData.orderDiscountAmount + lastSaleData.items.reduce((s, i) => s + i.discount, 0),
      totalTax: lastSaleData.tax,
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

  // Accept format directly to avoid React state race condition
  const handlePrint = (format: 'a4' | 'thermal') => {
    const tempSale = buildTempSale()
    if (!tempSale || !lastSaleData) return

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
          Quick Sale
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

      {/* Left: Manual Entry Form + Product List */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${mobileTab === 'cart' ? 'hidden sm:flex' : 'flex'}`}>
        <div data-tour="pos-lite-header" className="px-6 pt-4 pb-3 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QUICK BILL - Manual Entry</h2>
              <button
                onClick={pageTutorial.openTutorial}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm shrink-0"
              >
                <Video size={14} className="animate-pulse" />
                <span>Video Guide</span>
              </button>
            </div>
            <button
              data-tour="pos-lite-scan-btn"
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add any product manually — or scan a barcode to add registered products instantly
          </p>

          {/* Barcode Scan Input Panel */}
          {isScanMode && (
            <div className="mb-4 p-4 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 flex flex-col gap-3">
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

          {/* Manual Product Entry Form */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2" data-tour="pos-lite-name-input">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name *
                </label>
                <Input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price (₹) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={productPrice}
                  onChange={e => setProductPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={productQty}
                  onChange={e => setProductQty(e.target.value)}
                  placeholder="1"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GST (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={productTaxRate}
                  onChange={e => setProductTaxRate(e.target.value)}
                  placeholder="0"
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col md:flex-row items-start md:items-center gap-4">
              {/* GST Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setGstMode('exclusive')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    gstMode === 'exclusive'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  + GST (Excl.)
                </button>
                <button
                  type="button"
                  onClick={() => setGstMode('inclusive')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    gstMode === 'inclusive'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Incl. GST
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {gstMode === 'exclusive'
                  ? 'Price is base price — GST will be added on top'
                  : 'Price already includes GST — base price will be extracted'}
              </p>
              <Button
                data-tour="pos-lite-add-cart-btn"
                onClick={addItem}
                leftIcon={<Plus size={16} />}
                className="md:ml-auto w-full md:w-auto"
              >
                Add to Cart
              </Button>
            </div>
          </Card>
        </div>


        {/* Mobile: View Cart sticky bar */}
        {items.length > 0 && (
          <div data-tour="pos-lite-tab-cart" className="sm:hidden flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
      <Card data-tour="pos-lite-cart" className={`sm:w-[400px] w-full flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 rounded-none h-full min-h-0 max-h-full overflow-hidden ${mobileTab === 'products' ? 'hidden sm:flex' : 'flex'}`}>
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

          {/* Customer Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(true)}
              title="Add new customer"
              aria-label="Add new customer"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              <UserPlus size={18} />
            </button>
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

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-700">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
              <ShoppingCart size={48} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Add items on the left to start billing</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-400">
                      {formatINR(item.sellingPrice)} {item.taxRate > 0 && `(+${item.taxRate}% GST)`}
                    </p>
                  </div>
                  <p className="font-bold text-sm text-gray-900 dark:text-gray-100 flex-shrink-0">{formatINR(item.total)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-gray-900 dark:text-gray-100">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Section: Discount + Totals + Complete & Print Button */}
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 pb-14 sm:pb-4 space-y-2 mt-auto">
          {/* Order Discount */}
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
          <div data-tour="pos-lite-checkout-btn">
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
            loading={isCreating}
            disabled={method === 'cash' && !isComplete}
            className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            Complete & Print
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

          {/* Cash Payment - Amount Paid */}
          {method === 'cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount Received
              </label>
              <Input
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="text-lg py-3"
              />
              {amountPaidNum > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-700 dark:text-emerald-300">Change</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {formatINR(Math.max(0, change))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Print Modal */}
      <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="Print Receipt" size="sm">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {completedInvoiceNumber && `Invoice: ${completedInvoiceNumber}`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Select print format:</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePrint('a4')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <Printer size={32} className="text-gray-400" />
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
            onClick={() => { setIsPrintModalOpen(false); setCompletedSaleId(''); setCompletedInvoiceNumber('') }}
            className="w-full"
          >
            Skip Print
          </Button>
        </div>
      </Modal>

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
        pageKey="pos-lite"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
