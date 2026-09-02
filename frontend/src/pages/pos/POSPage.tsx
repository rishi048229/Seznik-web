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
import { useLocationStock } from '@/hooks/useLocations'
import { LocationSelector } from '@/components/common/LocationSelector'
import { BleConnectButton } from '@/components/common/BleConnectButton'
import { UpiQrPanel } from '@/components/common/UpiQrPanel'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Wallet, Smartphone, UserPlus, Barcode, Filter, Printer, FileText, ScanLine, Bluetooth, X, ArrowUpDown, Calendar, AlertTriangle, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { RealisticReceiptModal } from '@/components/common/RealisticReceiptModal'
import { QuickEditProductModal } from './components/QuickEditProductModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { POSPageSkeleton } from '@/components/ui/PageSkeleton'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { getTopLevelCategories, getChildCategories } from '@/utils/categoryTree'
import { useLanguage } from '@/contexts/LanguageContext'
import { trackUserAction } from '@/utils/analytics'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import type { Product } from '@/types/product.types'
import type { Sale } from '@/types/sale.types'
import type { Category } from '@/services/categoryService'

const pillClass = (active: boolean, nested = false) =>
  `rounded-full font-semibold whitespace-nowrap transition-all shrink-0 ${
    nested ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-1.5 text-xs sm:text-sm'
  } ${
    active
      ? 'bg-[#0a0a2e] text-white shadow-sm ring-2 ring-blue-500/20'
      : nested
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
  }`

const CategoryTabsRow = ({
  categories,
  selectedCategory,
  onSelect,
  allLabel,
}: {
  categories: Category[] | undefined
  selectedCategory: string
  onSelect: (id: string) => void
  allLabel: string
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateOverflow = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    updateOverflow()
    const el = scrollerRef.current
    if (!el) return
    const frame = window.requestAnimationFrame(updateOverflow)
    el.addEventListener('scroll', updateOverflow, { passive: true })
    window.addEventListener('resize', updateOverflow)
    return () => {
      window.cancelAnimationFrame(frame)
      el.removeEventListener('scroll', updateOverflow)
      window.removeEventListener('resize', updateOverflow)
    }
  }, [categories, selectedCategory])

  const scrollByAmt = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

  return (
    <div className="relative mt-2 flex items-center gap-1">
      <button
        type="button"
        aria-label="Scroll categories left"
        onClick={() => scrollByAmt(-1)}
        disabled={!canLeft}
        className="hidden md:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronLeft size={16} />
      </button>
      <div
        ref={scrollerRef}
        data-tour="pos-category-tabs"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
        className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x select-none min-w-0 flex-1"
      >
        <button type="button" onClick={() => onSelect('')} className={pillClass(!selectedCategory)}>
          {allLabel}
        </button>
        {getTopLevelCategories(categories).map((parent) => (
          <Fragment key={parent.id}>
            <button type="button" onClick={() => onSelect(parent.id)} className={pillClass(selectedCategory === parent.id)}>
              {parent.name}
            </button>
            {getChildCategories(categories, parent.id).map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                className={pillClass(selectedCategory === child.id, true)}
              >
                › {child.name}
              </button>
            ))}
          </Fragment>
        ))}
      </div>
      <button
        type="button"
        aria-label="Scroll categories right"
        onClick={() => scrollByAmt(1)}
        disabled={!canRight}
        className="hidden md:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export const POSPage = () => {
  const { t } = useLanguage()
  const pageTutorial = usePageTutorial('pos')
  const navigate = useNavigate()
  const { data: products, isLoading } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: settings } = useSettings()
  const { items, addItem, removeItem, updateQty, clearCart, totals, updateItemDetails } = useCart()
  const { mutate: createSale, isPending: isCreating } = useCreateSale()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isRealisticReceiptOpen, setIsRealisticReceiptOpen] = useState(false)
  const [currentSaleForReceipt, setCurrentSaleForReceipt] = useState<Partial<Sale> | null>(null)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState<boolean>(() => settings?.receiptConfig?.showTaxBreakdown ?? true)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const blePrinter = useBlePrinter()

  // Quick-edit a product's own details (name/price/stock/etc.) without leaving
  // the billing screen — opened from either the product grid or a cart line.
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditProductOpen, setIsEditProductOpen] = useState(false)
  const openEditProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    setEditingProduct(product)
    setIsEditProductOpen(true)
  }

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
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split('T')[0])
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

  // Multi-location inventory: when a location is selected, stock/price
  // resolve through that location's own ProductLocationStock row instead of
  // the product's flat totals. A product with no stock row at the selected
  // location is 0 available there — it does NOT fall back to the flat
  // total, since that's the entire point of per-location stock.
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { data: locationStockRows = [] } = useLocationStock(selectedLocationId)
  const locationStockMap = new Map(locationStockRows.map(r => [r.productId, r]))

  const getEffectiveStock = (product: Product): number => {
    if (!selectedLocationId) return product.currentStock
    return locationStockMap.get(product.id)?.stock ?? 0
  }
  const getEffectivePrice = (product: Product): number => {
    if (!selectedLocationId) return product.sellingPrice
    const override = locationStockMap.get(product.id)?.priceOverride
    return override ?? product.sellingPrice
  }
  /** The exact object to hand to addItem/cart logic so the cart line carries the location's price. */
  const withEffectivePrice = (product: Product): Product => {
    const price = getEffectivePrice(product)
    return price === product.sellingPrice ? product : { ...product, sellingPrice: price }
  }

  // Barcode scanner integration
  const handleBarcodeScan = (barcode: string) => {
    const product = products?.find(p => p.barcode === barcode && p.isActive !== false)
    if (product) {
      addItem(withEffectivePrice(product))
      toast.success(`${product.name} ${t('pos.addedSuffix')}`)
    } else {
      toast.error(`${t('pos.productNotFoundPrefix')} ${barcode}`)
    }
  }

  useBarcodeScanner({
    mode: 'pos',
    onScan: handleBarcodeScan,
    enabled: !isPaymentOpen && !isPrintModalOpen && !isRealisticReceiptOpen,
  })

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
      const available = getEffectiveStock(p) - reserved
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'out' && available <= 0) ||
        (stockFilter === 'low' && available > 0 && available <= p.lowStockThreshold) ||
        (stockFilter === 'in' && available > p.lowStockThreshold)

      const matchesPriceMin = isNaN(priceMinNum) || p.sellingPrice >= priceMinNum
      const matchesPriceMax = isNaN(priceMaxNum) || p.sellingPrice <= priceMaxNum

      // Once a store is picked, only show what that store actually carries
      // (has a stock row for) — a bare price/stock swap wasn't enough; the
      // grid itself needs to reflect "this store's catalog," not every
      // product in the whole business.
      const matchesStoreScope = !selectedLocationId || locationStockMap.has(p.id)

      return matchesSearch && matchesCategory && matchesStock && matchesPriceMin && matchesPriceMax && matchesStoreScope
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

  useEffect(() => {
    if (isPaymentOpen) {
      if (method === 'credit') {
        setAmountPaid('0')
      } else if (!amountPaid || amountPaid === '0') {
        setAmountPaid(finalTotal.toString())
      }
    }
  }, [isPaymentOpen, method, finalTotal])

  const handleProductClick = (product: Product) => {
    const reserved = cartReserved[product.id] || 0
    const available = getEffectiveStock(product) - reserved
    if (available <= 0) {
      toast.error(selectedLocationId ? `${t('pos.errOutOfStock')} at this location` : t('pos.errOutOfStock'))
    } else {
      addItem(withEffectivePrice(product))
    }
  }

  const addFromSearchOrScan = (raw: string) => {
    const q = raw.trim()
    if (!q) return false
    const byBarcode = activeProducts.find(p => p.barcode && p.barcode.toLowerCase() === q.toLowerCase())
    if (byBarcode) {
      handleProductClick(byBarcode)
      setSearch('')
      setScanInput('')
      return true
    }
    if (filtered.length === 1) {
      handleProductClick(filtered[0])
      setSearch('')
      return true
    }
    return false
  }

  const handleSearchSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!addFromSearchOrScan(search || scanInput)) {
      if (search.trim()) toast.error('No exact product match — tap a card or scan again')
    }
  }

  const handleUpdateQty = (productId: string, newQty: number) => {
    const product = products?.find(p => p.id === productId)
    if (!product) return
    const reserved = cartReserved[productId] || 0
    const otherQty = reserved - (items.find(i => i.productId === productId)?.quantity || 0)
    const maxAllowed = getEffectiveStock(product) - otherQty

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
  const unpaidAmount = Math.max(0, finalTotal - amountPaidNum)
  const change = Math.max(0, amountPaidNum - finalTotal)
  const isComplete = unpaidAmount <= 0.01 || Boolean(selectedCustomer)

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
          priceIncludesGst: item.priceIncludesGst ?? false,
          taxAmount: ((item.sellingPrice * item.quantity - item.discount) * itemTaxRate / 100),
          total: item.sellingPrice * item.quantity - item.discount,
        }
      }),
      subtotal: totals.subtotal,
      totalDiscount: orderDiscountAmount + items.reduce((s, i) => s + i.discount, 0),
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: amountPaidNum,
      changeReturned: change,
      isQuickBill: false,
      createdAt: billDate ? new Date(billDate + 'T12:00:00').toISOString() : undefined,
    }

    // Only set customerId if a customer is selected (Firestore rejects undefined)
    if (selectedCustomer) {
      saleData.customerId = selectedCustomer
    }
    // Multi-location inventory: stamps which location's stock this whole
    // sale decrements. Absent entirely when no location is selected, so the
    // backend takes its legacy flat-stock path unchanged.
    if (selectedLocationId) {
      ;(saleData as Record<string, unknown>).locationId = selectedLocationId
    }

    createSale(saleData, {
      onSuccess: (result) => {
        trackUserAction('pos_checkout_completed', { grandTotal: finalTotal, itemCount: items.length, paymentMethod: method })
        const saleId = result.id
        const invoiceNumber = result.invoiceNumber
        const snapshot = {
          items: [...items],
          totals: { ...totals, tax: taxAmount },
          orderDiscountAmount,
          finalTotal,
          method,
          amountPaidNum,
          selectedCustomer,
        }
        setLastSaleData(snapshot)
        setCompletedSaleId(saleId)
        setCompletedInvoiceNumber(invoiceNumber)
        clearCart()
        setOrderDiscount(0)
        setSelectedCustomer('')
        setIsPaymentOpen(false)
        setMethod('cash')
        setAmountPaid('')
        toast.success(t('pos.saleCompleted'))
        setIsPrintModalOpen(true)
      },
      onError: (error) => {
        console.error('Sale creation failed:', error)
        toastError(error, t('pos.errFailedCreateSale'))
      },
    })
  }

  const handlePreviewCurrentBill = () => {
    if (items.length === 0) {
      toast.error('Add items to cart to preview receipt')
      return
    }
    const tempSale: Partial<Sale> = {
      id: `draft-${Date.now()}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      subtotal: totals.subtotal,
      totalDiscount: orderDiscountAmount,
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: amountPaidNum || finalTotal,
      changeReturned: change,
      isQuickBill: false,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate || 0,
        taxAmount: ((item.sellingPrice * item.quantity - item.discount) * (item.taxRate || 0)) / 100,
        total: item.sellingPrice * item.quantity - item.discount,
      })),
      customerId: selectedCustomer,
    }
    setCurrentSaleForReceipt(tempSale)
    setIsRealisticReceiptOpen(true)
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

    const receiptConfig = resolveEffectiveReceiptConfig(settings)
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
      printerConfig: settings?.printerConfig,
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
      const receiptConfig = resolveEffectiveReceiptConfig(settings)
      const customerName = lastSaleData.selectedCustomer
        ? customers?.find(c => c.id === lastSaleData.selectedCustomer)?.name
        : ''
      const bytes = await generateReceiptEscPos({
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
      toastError(error, t('pos.errFailedPrintBluetooth'))
    } finally {
      setIsBlePrinting(false)
    }
  }

  if (isLoading) {
    return <POSPageSkeleton />
  }

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-4.25rem)] gap-0 -mx-3 sm:-mx-4 lg:-mx-6 -mt-3 sm:-mt-4 lg:-mt-6 min-h-0 min-w-0 max-w-full overflow-hidden">

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
          {t('pos.productsTab')}
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
            mobileTab === 'cart'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {t('pos.cartTab')}
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
        <div data-tour="pos-search-bar" className="px-3 sm:px-5 pt-3 pb-2 bg-white dark:bg-gray-900 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div data-tour="pos-search-input" className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search or scan — Enter adds the match"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-10 h-12 text-sm rounded-xl"
                autoComplete="off"
              />
              <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
            </div>
            <div className="relative w-[6.5rem] sm:w-40 shrink-0">
              <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500" size={15} />
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const code = scanInput.trim()
                    if (code.length >= 4) handleBarcodeScan(code)
                    setScanInput('')
                  }
                }}
                placeholder="Scan"
                className="pl-8 pr-2 h-12 text-sm font-mono rounded-xl"
                autoComplete="off"
              />
            </div>
            <div ref={filterPanelRef} className="relative shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(v => !v)}
                className={`relative h-12 w-12 p-0 rounded-xl flex items-center justify-center ${hasActiveFilters ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40' : ''}`}
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
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('pos.filters')}</h4>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          <X size={12} /> {t('pos.clearAll')}
                        </button>
                      )}
                    </div>

                    {/* Stock Status */}
                    <div className="mb-4">
                      <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        {t('pos.stockStatus')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'all', label: t('pos.allStock') },
                          { value: 'in', label: t('pos.inStock') },
                          { value: 'low', label: t('pos.lowStock') },
                          { value: 'out', label: t('pos.outOfStock') },
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
                        {t('pos.priceRange')}
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder={t('pos.min')}
                          value={priceMin}
                          onChange={e => setPriceMin(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <span className="text-gray-400 text-xs">{t('pos.to')}</span>
                        <Input
                          type="number"
                          placeholder={t('pos.max')}
                          value={priceMax}
                          onChange={e => setPriceMax(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Sort By */}
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        <ArrowUpDown size={12} /> {t('pos.sortBy')}
                      </label>
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as SortOption)}
                        className="w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="name-asc">{t('pos.sortNameAsc')}</option>
                        <option value="name-desc">{t('pos.sortNameDesc')}</option>
                        <option value="price-asc">{t('pos.sortPriceAsc')}</option>
                        <option value="price-desc">{t('pos.sortPriceDesc')}</option>
                        <option value="stock-asc">{t('pos.sortStockAsc')}</option>
                        <option value="stock-desc">{t('pos.sortStockDesc')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </form>

          {/* Billing location (only shown when multi-location inventory is enabled) */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <LocationSelector onChange={setSelectedLocationId} />
            <BleConnectButton />
          </div>

          {/* Category Tabs */}
          <CategoryTabsRow
            categories={categories}
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
            allLabel={t('pos.allProducts')}
          />
        </div>

        {/* Product Grid */}
        <div data-tour="pos-product-grid" className="flex-1 overflow-y-auto px-3 sm:px-5 pt-3 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map(product => {
              const reserved = cartReserved[product.id] || 0
              const available = getEffectiveStock(product) - reserved
              const isOutOfStock = available <= 0
              const isLowStock = available > 0 && available <= product.lowStockThreshold

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleProductClick(product)}
                  className={`group flex flex-col rounded-2xl border p-3 sm:p-3.5 transition-all duration-150 ${
                    isOutOfStock
                      ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
                      : 'cursor-pointer border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-blue-400 hover:bg-blue-50/70 dark:hover:border-blue-700 dark:hover:bg-blue-950/20 hover:shadow-md'
                  }`}
                >
                  <div className="w-full h-24 sm:h-28 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {product.imageURL ? (
                      <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingCart size={28} className="text-gray-300" />
                    )}
                  </div>

                  <p className="mt-2.5 text-sm font-semibold leading-snug break-words line-clamp-2 min-h-[2.5rem] text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    {product.name}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-blue-600">{formatINR(getEffectivePrice(product))}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      isOutOfStock
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                    }`}>
                      {isOutOfStock ? t('pos.outOfStock') : `${t('pos.stockCount')}: ${available}`}
                    </span>
                  </div>

                  <div className="mt-auto pt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => openEditProduct(e, product)}
                      title={t('products.editProduct')}
                      className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={(e) => { e.stopPropagation(); if (!isOutOfStock) handleProductClick(product) }}
                      className="flex-1 h-9 rounded-xl bg-[#0a0a2e] hover:bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search size={48} className="mb-4 opacity-30" />
              <p className="text-sm">{search ? t('pos.noProductsMatchSearch') : t('pos.noProductsAvailable')}</p>
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
              <span>{t('pos.viewCart')}</span>
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
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('pos.checkout')}</h2>
              <Badge variant="info">{t('pos.orderPrefix')}{String(Date.now()).slice(-4)}</Badge>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmountPaid(finalTotal.toString())
                  setIsPaymentOpen(true)
                }}
                disabled={isCreating}
                title={t('pos.completeAndPrint')}
                className="sm:hidden px-3 py-1.5 bg-[#0a0a2e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
              >
                <Printer size={15} />
                <span>{t('pos.print')}</span>
              </button>
            )}
          </div>

          {/* Customer Selector (optional - walk-in by default) — searchable by name/phone */}
          <div data-tour="pos-customer-select">
            <CustomerSelect value={selectedCustomer} onChange={setSelectedCustomer} size="compact" />
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 space-y-2 min-h-0">
          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm font-medium">{t('pos.cartEmpty')}</p>
              <p className="text-xs mt-1">{t('pos.cartEmptyHint')}</p>
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
                      <p className="text-xs text-gray-400">{formatINR(item.sellingPrice)} {t('pos.each')}</p>
                    </div>

                    {/* Edit + Delete Buttons - Right (always visible so touch devices without hover can reach them) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {product && (
                        <button
                          onClick={(e) => openEditProduct(e, product)}
                          title={t('products.editProduct')}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
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
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 pb-20 sm:pb-4 space-y-2">
          {/* Order Discount (Order-level only) */}
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={t('pos.discount')}
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
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none">{t('common.total')} ({items.length})</p>
                <p className="text-base font-bold text-[#0a0a2e] dark:text-white leading-tight">{formatINR(finalTotal)}</p>
              </div>
            </div>
          )}

          {/* Payment & Preview Action Buttons */}
          <div data-tour="pos-checkout-btn" className="space-y-2">
            <Button
              onClick={() => {
                setAmountPaid(finalTotal.toString())
                setIsPaymentOpen(true)
              }}
              disabled={items.length === 0 || isCreating}
              className="w-full h-11 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555] shadow-md"
            >
              <Printer size={18} className="mr-2" />
              {t('pos.completeAndPrint')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviewCurrentBill}
              disabled={items.length === 0}
              leftIcon={<FileText size={15} className="text-indigo-600" />}
              className="w-full h-10 text-xs font-semibold border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              Preview &amp; edit bill
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={t('pos.completePayment')}
        size="md"
        footer={
          <Button
            onClick={handleCheckout}
            disabled={!isComplete || isCreating}
            loading={isCreating}
            className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            {isComplete ? t('pos.completeAndPrint') : t('pos.insufficientAmount')}
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Total Display */}
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.totalAmount')}</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-2">{formatINR(finalTotal)}</p>
          </div>

          {/* Bill Date Selector (Custom / Backdated Invoice) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
              Bill Date (Select for Backdated / Custom Date Invoice)
            </label>
            <Input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              className="text-sm font-medium"
            />
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('pos.paymentMethod')}</label>
            <div className="grid grid-cols-4 gap-3">
              {([
                { id: 'cash' as const, label: t('pos.cash'), icon: Wallet },
                { id: 'card' as const, label: t('pos.card'), icon: CreditCard },
                { id: 'upi' as const, label: t('pos.upi'), icon: Smartphone },
                { id: 'credit' as const, label: t('pos.credit'), icon: UserPlus },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
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
            {method === 'upi' && settings?.receiptConfig?.upiId && (
              <div className="mt-3">
                <UpiQrPanel
                  upiId={settings.receiptConfig.upiId}
                  payeeName={settings?.businessName || 'Store'}
                  amount={finalTotal}
                />
              </div>
            )}
          </div>

          {/* Amount Paid / Received Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('pos.amountReceived')} ({method.toUpperCase()})
            </label>
            <Input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="text-lg py-3 font-semibold"
            />

            {method === 'cash' && (
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountPaid(String(amt))}
                    className="flex-1 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300 transition-colors"
                  >
                    {formatINR(amt)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Partial Credit Allocation & Change Badges */}
          {unpaidAmount > 0.01 ? (
            selectedCustomer ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <UserPlus size={15} className="text-amber-600 dark:text-amber-400" />
                  Partial Credit Allocation
                </div>
                <p>
                  {formatINR(amountPaidNum)} paid via {method.toUpperCase()}. Remaining <strong className="text-amber-900 dark:text-amber-100">{formatINR(unpaidAmount)}</strong> will be added to <strong>{customers?.find(c => c.id === selectedCustomer)?.name}</strong>'s Credit Balance.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
                  Customer Selection Required for Credit
                </div>
                <p>
                  Unpaid balance of <strong>{formatINR(unpaidAmount)}</strong> cannot be issued to a walk-in customer. Please select a registered customer to record credit, or collect full payment.
                </p>
              </div>
            )
          ) : change > 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex justify-between items-center">
              <span className="font-medium">{t('pos.change')}</span>
              <span className="font-extrabold text-sm">{formatINR(change)}</span>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isPrintModalOpen}
        onClose={finishPrintFlow}
        title={t('pos.completeAndPrint')}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sale saved. Choose how to print this bill.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handlePrint('a4')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <FileText size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">{t('pos.a4Paper')}</p>
                <p className="text-xs text-gray-400">{t('pos.standardFormat')}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                if (shouldPrintThermalOverBle(settings, blePrinter)) {
                  void handlePrintBluetooth()
                } else {
                  handlePrint('thermal')
                }
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#0a0a2e] dark:hover:border-[#0a0a2e] transition-all"
            >
              <Printer size={32} className="text-gray-400" />
              <div className="text-center">
                <p className="font-bold text-gray-900 dark:text-gray-100">{t('pos.thermal50mm')}</p>
                <p className="text-xs text-gray-400">{t('pos.posPrinter')}</p>
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
              {blePrinter.status === 'connected' ? `${t('pos.printToDevice')} ${blePrinter.deviceName}` : t('pos.printViaBluetooth')}
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={finishPrintFlow}>
            {t('action.cancel')}
          </Button>
        </div>
      </Modal>

      {/* Live receipt preview — before payment only */}
      <RealisticReceiptModal
        isOpen={isRealisticReceiptOpen}
        onClose={() => setIsRealisticReceiptOpen(false)}
        sale={currentSaleForReceipt}
        settings={settings}
        initialCustomerName={selectedCustomer ? customers?.find(c => c.id === selectedCustomer)?.name : ''}
        initialCustomerPhone={selectedCustomer ? customers?.find(c => c.id === selectedCustomer)?.phone : ''}
        blePrinter={blePrinter}
        onDone={finishPrintFlow}
      />

      {/* Quick Edit Product Modal — edit name/price/stock/GST/etc. without leaving billing */}
      <QuickEditProductModal
        product={editingProduct}
        isOpen={isEditProductOpen}
        onClose={() => setIsEditProductOpen(false)}
        onSaved={(updated) => {
          if (editingProduct) {
            updateItemDetails(editingProduct.id, {
              productName: updated.name,
              sellingPrice: updated.sellingPrice,
              taxRate: updated.taxRate,
              priceIncludesGst: updated.priceIncludesGst,
            })
          }
        }}
      />

      <PrinterAnimationModal
        isOpen={isPrintingAnimating}
        onClose={() => setIsPrintingAnimating(false)}
        invoiceNumber="INV-RECENT"
        grandTotal={lastSaleData?.finalTotal || lastSaleData?.totals?.grandTotal}
        businessName={settings?.businessName}
        itemCount={lastSaleData?.items?.length}
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
