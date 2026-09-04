import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateSale } from '@/hooks/useSales'

import { useCustomers } from '@/hooks/useCustomers'
import { useSettings } from '@/hooks/useSettings'
import { useLocationStock } from '@/hooks/useLocations'
import { LocationSelector } from '@/components/common/LocationSelector'
import { BleConnectButton } from '@/components/common/BleConnectButton'
import { UpiQrPanel } from '@/components/common/UpiQrPanel'
import { isExpiringSoon, formatExpiryMessage } from '@/utils/expiry'
import { useProducts } from '@/hooks/useProducts'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { CustomerSelect } from '@/components/common/CustomerSelect'
import { RealisticReceiptModal } from '@/components/common/RealisticReceiptModal'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Wallet, Smartphone, UserPlus, Printer, Barcode, ScanLine, Bluetooth, Video, Calendar, AlertTriangle, Search, History, RotateCcw, Edit2, Check, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { ROUTES } from '@/constants/routes'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { useLanguage } from '@/contexts/LanguageContext'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { useAuth } from '@/contexts/AuthContext'
import { adoptLegacyJson, writeAccountJson } from '@/utils/accountStorage'
import type { Sale } from '@/types/sale.types'
import type { Product } from '@/types/product.types'

interface CartItem {
  id: string
  productName: string
  quantity: number
  sellingPrice: number
  discount: number
  taxRate: number
  priceIncludesGst?: boolean
  total: number
}

interface RecentQuickItem {
  productId?: string
  productName: string
  sellingPrice: number
  taxRate: number
  priceIncludesGst: boolean
}

const GST_PRESETS = [0, 5, 12, 18, 28] as const
const RECENT_STORAGE_KEY = 'pos_lite_recent_items'
const LAST_BILL_STORAGE_KEY = 'pos_lite_last_bill'
const LITE_CART_STORAGE_KEY = 'pos_lite_cart'
const MAX_RECENT = 16

const chipClass = (active: boolean) =>
  `inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
    active
      ? 'bg-[#0a0a2e] text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
  }`

export const POSLitePage = () => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const userId = user?.id || user?.uid
  const pageTutorial = usePageTutorial('pos-lite')
  const navigate = useNavigate()
  const { mutate: createSale, isPending: isCreating } = useCreateSale()
  const { data: customers } = useCustomers()
  const { data: settings } = useSettings()
  const { data: products, isFetched: productsFetched } = useProducts()

  const scanInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [isScanMode, setIsScanMode] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null)
  const ownedProductIds = useMemo(() => new Set((products ?? []).map(p => p.id)), [products])
  const [recentItems, setRecentItems] = useState<RecentQuickItem[]>([])
  const [lastBill, setLastBill] = useState<CartItem[]>([])

  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')

  // Persist Quick Bill cart state per account so another shop on this browser cannot see it
  const [items, setItems] = useState<CartItem[]>([])
  const liteHydratedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) {
      liteHydratedFor.current = null
      setItems([])
      setRecentItems([])
      setLastBill([])
      return
    }
    if (!productsFetched) return
    setItems(adoptLegacyJson<CartItem>(LITE_CART_STORAGE_KEY, userId, ownedProductIds, []))
    setRecentItems(adoptLegacyJson<RecentQuickItem>(RECENT_STORAGE_KEY, userId, ownedProductIds, []))
    setLastBill(adoptLegacyJson<CartItem>(LAST_BILL_STORAGE_KEY, userId, ownedProductIds, []))
    liteHydratedFor.current = userId
  }, [userId, productsFetched, ownedProductIds])

  useEffect(() => {
    if (!userId || liteHydratedFor.current !== userId) return
    writeAccountJson(LITE_CART_STORAGE_KEY, userId, items)
  }, [items, userId])

  useEffect(() => {
    if (!userId || liteHydratedFor.current !== userId) return
    writeAccountJson(RECENT_STORAGE_KEY, userId, recentItems)
  }, [recentItems, userId])

  useEffect(() => {
    if (!userId || liteHydratedFor.current !== userId) return
    writeAccountJson(LAST_BILL_STORAGE_KEY, userId, lastBill)
  }, [lastBill, userId])

  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isRealisticReceiptOpen, setIsRealisticReceiptOpen] = useState(false)
  const [currentSaleForReceipt, setCurrentSaleForReceipt] = useState<Partial<Sale> | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState<boolean>(() => settings?.receiptConfig?.showTaxBreakdown ?? true)
  const [isBlePrinting, setIsBlePrinting] = useState(false)
  const blePrinter = useBlePrinter()
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percent'>('flat')
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split('T')[0])
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
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)

  // Multi-location inventory: resolve this location's price override, if any
  // (see LocationSelector/POSPage for the full explanation of the model).
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { data: locationStockRows = [] } = useLocationStock(selectedLocationId)
  const getEffectivePrice = (product: { id: string; sellingPrice: number }): number => {
    if (!selectedLocationId) return product.sellingPrice
    const override = locationStockRows.find(r => r.productId === product.id)?.priceOverride
    return override ?? product.sellingPrice
  }

  const nameSuggestions = useMemo(() => {
    const q = productName.trim().toLowerCase()
    if (!q) return []
    return (products ?? [])
      .filter(p => p.isActive !== false && (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      ))
      .slice(0, 6)
  }, [products, productName])

  const catalogHits = useMemo(() => {
    const list = (products ?? []).filter(p => p.isActive !== false)
    const q = catalogQuery.trim().toLowerCase()
    const filtered = q
      ? list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q)
        )
      : list
    const recentIds = new Set(recentItems.map(r => r.productId).filter((id): id is string => Boolean(id)))
    return [...filtered]
      .sort((a, b) => {
        const ar = recentIds.has(a.id) ? 0 : 1
        const br = recentIds.has(b.id) ? 0 : 1
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name)
      })
      .slice(0, 20)
  }, [products, catalogQuery, recentItems])

  const rememberRecent = (item: RecentQuickItem) => {
    setRecentItems(prev => {
      const key = item.productId || `${item.productName.toLowerCase()}|${item.sellingPrice}|${item.taxRate}`
      const next = [
        item,
        ...prev.filter(r => (r.productId || `${r.productName.toLowerCase()}|${r.sellingPrice}|${r.taxRate}`) !== key),
      ].slice(0, MAX_RECENT)
      try {
        writeAccountJson(RECENT_STORAGE_KEY, userId, next)
      } catch {
        /* ignore quota */
      }
      return next
    })
  }

  const pushLine = (line: Omit<CartItem, 'total'>) => {
    setItems(prev => {
      const matchIdx = prev.findIndex(i => {
        if (!line.id.startsWith('temp-')) return i.id === line.id
        return (
          i.id.startsWith('temp-') &&
          i.productName.toLowerCase() === line.productName.toLowerCase() &&
          i.sellingPrice === line.sellingPrice &&
          i.taxRate === line.taxRate &&
          Boolean(i.priceIncludesGst) === Boolean(line.priceIncludesGst)
        )
      })
      if (matchIdx >= 0) {
        return prev.map((i, idx) => {
          if (idx !== matchIdx) return i
          const qty = i.quantity + line.quantity
          return { ...i, quantity: qty, total: i.sellingPrice * qty }
        })
      }
      return [...prev, { ...line, total: line.sellingPrice * line.quantity }]
    })
    rememberRecent({
      productId: line.id.startsWith('temp-') ? undefined : line.id,
      productName: line.productName,
      sellingPrice: line.sellingPrice,
      taxRate: line.taxRate,
      priceIncludesGst: line.priceIncludesGst ?? false,
    })
  }

  const handleSelectSuggestedProduct = (p: Product) => {
    const effectivePrice = getEffectivePrice(p)
    setLinkedProductId(p.id)
    setProductName(p.name)
    setProductPrice(String(effectivePrice))
    setProductTaxRate(String(p.taxRate ?? 0))
    setGstMode(p.priceIncludesGst ? 'inclusive' : 'exclusive')
    setShowNameSuggestions(false)
  }

  // Barcode scan: look up product from catalog and add directly to cart
  const handleBarcodeScan = (barcode: string) => {
    const product = products?.find(p => p.barcode === barcode && p.isActive !== false)
    if (!product) {
      toast.error(`${t('pos.noProductFoundBarcodePrefix')} ${barcode}`)
      return
    }
    const effectivePrice = getEffectivePrice(product)
    const existing = items.find(i => i.id === product.id)
    if (existing) {
      pushLine({
        id: product.id,
        productName: product.name,
        quantity: 1,
        sellingPrice: existing.sellingPrice,
        discount: 0,
        taxRate: existing.taxRate,
        priceIncludesGst: existing.priceIncludesGst,
      })
    } else {
      pushLine({
        id: product.id,
        productName: product.name,
        quantity: 1,
        sellingPrice: effectivePrice,
        discount: 0,
        taxRate: product.taxRate,
        priceIncludesGst: product.priceIncludesGst ?? false,
      })
    }
    toast.success(`${product.name} ${t('pos.addedViaScanSuffix')}`)
    if (isExpiringSoon(product.expiryDate)) {
      toast(`⚠ ${product.name} — ${formatExpiryMessage(product.expiryDate)}`, { icon: '⏳' })
    }
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
      toast.error(t('pos.errEnterProductName'))
      return
    }
    const price = parseFloat(productPrice)
    if (isNaN(price) || price <= 0) {
      toast.error(t('pos.errValidPrice'))
      return
    }
    const qty = parseInt(productQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('pos.errValidQuantity'))
      return
    }
    const taxRate = parseFloat(productTaxRate) || 0
    if (taxRate < 0 || taxRate > 100) {
      toast.error(t('pos.errGstRange'))
      return
    }

    const newItem: Omit<CartItem, 'total'> = {
      id: linkedProductId || `temp-${Date.now()}-${Math.random()}`,
      productName: productName.trim(),
      quantity: qty,
      sellingPrice: price,
      discount: 0,
      taxRate,
      priceIncludesGst: gstMode === 'inclusive',
    }

    pushLine(newItem)
    setProductName('')
    setProductPrice('')
    setProductQty('1')
    setProductTaxRate('0')
    setLinkedProductId(null)
    toast.success(`${newItem.productName} ${t('pos.addedSuffix')}`)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  const addFromRecent = (item: RecentQuickItem) => {
    pushLine({
      id: item.productId || `temp-${Date.now()}-${Math.random()}`,
      productName: item.productName,
      quantity: 1,
      sellingPrice: item.sellingPrice,
      discount: 0,
      taxRate: item.taxRate,
      priceIncludesGst: item.priceIncludesGst,
    })
    toast.success(`${item.productName} ${t('pos.addedSuffix')}`)
  }

  const addFromCatalog = (product: Product) => {
    const effectivePrice = getEffectivePrice(product)
    pushLine({
      id: product.id,
      productName: product.name,
      quantity: 1,
      sellingPrice: effectivePrice,
      discount: 0,
      taxRate: product.taxRate,
      priceIncludesGst: product.priceIncludesGst ?? false,
    })
    toast.success(`${product.name} ${t('pos.addedSuffix')}`)
    if (isExpiringSoon(product.expiryDate)) {
      toast(`⚠ ${product.name} — ${formatExpiryMessage(product.expiryDate)}`, { icon: '⏳' })
    }
  }

  const replayLastBill = () => {
    if (lastBill.length === 0) return
    lastBill.forEach(item => {
      pushLine({
        id: item.id.startsWith('temp-') ? `temp-${Date.now()}-${Math.random()}` : item.id,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        priceIncludesGst: item.priceIncludesGst,
      })
    })
    toast.success(t('pos.lastBillAdded'))
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
    writeAccountJson(LITE_CART_STORAGE_KEY, userId, [])
    localStorage.removeItem(LITE_CART_STORAGE_KEY)
    setOrderDiscount(0)
    setSelectedCustomer('')
  }

  const subtotal = items.reduce((sum, item) => {
    const lineTotal = item.sellingPrice * item.quantity - item.discount
    if (item.priceIncludesGst && item.taxRate > 0) {
      return sum + (lineTotal / (1 + item.taxRate / 100))
    }
    return sum + lineTotal
  }, 0)

  const taxAmount = items.reduce((sum, item) => {
    const lineTotal = item.sellingPrice * item.quantity - item.discount
    if (item.priceIncludesGst && item.taxRate > 0) {
      const baseAmt = lineTotal / (1 + item.taxRate / 100)
      return sum + (lineTotal - baseAmt)
    }
    return sum + (lineTotal * (item.taxRate || 0) / 100)
  }, 0)

  const orderDiscountAmount = orderDiscountType === 'flat'
    ? orderDiscount
    : subtotal * (orderDiscount / 100)

  const finalTotal = subtotal + taxAmount - orderDiscountAmount

  useEffect(() => {
    if (isPaymentOpen) {
      if (method === 'credit') {
        setAmountPaid('0')
      } else if (!amountPaid || amountPaid === '0') {
        setAmountPaid(finalTotal.toString())
      }
    }
  }, [isPaymentOpen, method, finalTotal])

  const amountPaidNum = parseFloat(amountPaid) || 0
  const unpaidAmount = Math.max(0, finalTotal - amountPaidNum)
  const change = Math.max(0, amountPaidNum - finalTotal)
  const isComplete = unpaidAmount <= 0.01 || Boolean(selectedCustomer)

  const handleCheckout = () => {
    const saleData: Parameters<typeof createSale>[0] = {
      items: items.map(item => {
        const resolvedProductId = (!item.id.startsWith('temp-'))
          ? item.id
          : (products?.find(p => p.name.toLowerCase() === item.productName.toLowerCase())?.id || '')

        return {
          productId: resolvedProductId,
          productName: item.productName,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          priceIncludesGst: item.priceIncludesGst ?? false,
          taxAmount: ((item.sellingPrice * item.quantity - item.discount) * item.taxRate / 100),
          total: item.sellingPrice * item.quantity - item.discount,
        }
      }),
      subtotal,
      totalDiscount: orderDiscountAmount + items.reduce((s, i) => s + i.discount, 0),
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: amountPaidNum,
      changeReturned: change,
      isQuickBill: true,
      createdAt: billDate ? new Date(billDate + 'T12:00:00').toISOString() : undefined,
    }

    if (selectedCustomer) {
      saleData.customerId = selectedCustomer
    }
    if (selectedLocationId) {
      ;(saleData as Record<string, unknown>).locationId = selectedLocationId
    }

    createSale(saleData, {
      onSuccess: (result) => {
        const saleId = result.id
        const invoiceNumber = result.invoiceNumber
        const snapshot = {
          items: [...items],
          subtotal,
          tax: taxAmount,
          orderDiscountAmount,
          finalTotal,
          method,
          amountPaidNum,
          selectedCustomer,
        }
        setLastSaleData(snapshot)
        try {
          writeAccountJson(LAST_BILL_STORAGE_KEY, userId, items)
        } catch {
          /* ignore quota */
        }
        setLastBill(items)
        setCompletedSaleId(saleId)
        setCompletedInvoiceNumber(invoiceNumber)
        clearCart()
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

  const handleUpdateCartItem = (itemId: string, patch: Partial<CartItem>) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it
      const updated = { ...it, ...patch }
      const q = updated.quantity || 1
      const p = updated.sellingPrice || 0
      const d = updated.discount || 0
      updated.total = Math.max(0, q * p - d)
      return updated
    }))
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
      subtotal: subtotal,
      totalDiscount: orderDiscountAmount,
      totalTax: taxAmount,
      grandTotal: finalTotal,
      paymentMethod: method,
      amountPaid: amountPaidNum || finalTotal,
      changeReturned: change,
      isQuickBill: true,
      items: items.map(item => ({
        productId: item.id,
        productName: item.productName,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discount: item.discount,
        taxRate: item.taxRate || 0,
        taxAmount: ((item.sellingPrice * item.quantity - item.discount) * (item.taxRate || 0)) / 100,
        total: item.total,
      })),
      customerId: selectedCustomer,
    }
    setCurrentSaleForReceipt(tempSale)
    setIsRealisticReceiptOpen(true)
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

  const previewQty = Math.max(1, parseInt(productQty, 10) || 1)
  const previewPrice = parseFloat(productPrice) || 0
  const previewTax = parseFloat(productTaxRate) || 0
  const previewBase = previewPrice * previewQty
  const previewLineTotal =
    gstMode === 'inclusive' || previewTax <= 0
      ? previewBase
      : previewBase + (previewBase * previewTax) / 100

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
          {t('pos.quickSaleTab')}
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

      {/* Left: entry + fast-add tools */}
      <div className={`flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 ${mobileTab === 'cart' ? 'hidden sm:flex' : 'flex'}`}>
        <div data-tour="pos-lite-header" className="shrink-0 px-4 sm:px-5 pt-3 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{t('pos.quickBillManualEntry')}</h2>
                <button
                  onClick={pageTutorial.openTutorial}
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150 shrink-0"
                >
                  <Video size={13} />
                  {t('pos.videoGuide')}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{t('pos.addProductManualHint')}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {lastBill.length > 0 && (
                <button
                  type="button"
                  onClick={replayLastBill}
                  className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150"
                >
                  <RotateCcw size={14} />
                  {t('pos.repeatLastBill')}
                </button>
              )}
              <button
                data-tour="pos-lite-scan-btn"
                type="button"
                onClick={toggleScanMode}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  isScanMode
                    ? 'bg-[#0a0a2e] text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {isScanMode ? <ScanLine size={15} /> : <Barcode size={15} />}
                {isScanMode ? t('pos.scanning') : t('pos.scanBarcode')}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <LocationSelector onChange={setSelectedLocationId} />
            <BleConnectButton />
          </div>

          {isScanMode && (
            <div className="mt-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20">
              <form onSubmit={handleScanSubmit} className="flex gap-2">
                <Input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder={t('pos.scanPlaceholder')}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" disabled={scanInput.trim().length < 4}>
                  {t('pos.add')}
                </Button>
                <Button type="button" variant="ghost" onClick={toggleScanMode}>
                  {t('pos.done')}
                </Button>
              </form>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-4">
          <form
            onSubmit={e => {
              e.preventDefault()
              addItem()
            }}
          >
            <Card className="p-3 sm:p-4">
              <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
                <div className="col-span-2 lg:col-span-12 relative" data-tour="pos-lite-name-input">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('pos.productNameLabel')}
                  </label>
                  <Input
                    ref={nameInputRef}
                    value={productName}
                    onChange={e => {
                      setProductName(e.target.value)
                      setLinkedProductId(null)
                      setShowNameSuggestions(true)
                    }}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 250)}
                    placeholder={t('pos.enterProductName')}
                    className="w-full"
                    autoComplete="off"
                  />
                  {showNameSuggestions && productName.trim().length > 0 && nameSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-1 z-50 overflow-hidden">
                      {nameSuggestions.map(p => {
                        const price = getEffectivePrice(p)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault()
                              handleSelectSuggestedProduct(p)
                            }}
                            className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-150"
                          >
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                            <span className="text-xs text-gray-500 shrink-0">{formatINR(price)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('pos.priceLabel')}
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
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('pos.quantityLabel')}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setProductQty(String(Math.max(1, previewQty - 1)))}
                      className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 transition-colors duration-150 flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <Input
                      type="number"
                      min="1"
                      value={productQty}
                      onChange={e => setProductQty(e.target.value)}
                      className="w-full text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setProductQty(String(previewQty + 1))}
                      className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 transition-colors duration-150 flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="col-span-2 lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t('pos.gstLabel')}
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

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {GST_PRESETS.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    aria-pressed={Number(productTaxRate) === rate}
                    onClick={() => setProductTaxRate(String(rate))}
                    className={chipClass(Number(productTaxRate) === rate)}
                  >
                    {rate}%
                  </button>
                ))}
                <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:inline-block" />
                <button type="button" aria-pressed={gstMode === 'exclusive'} onClick={() => setGstMode('exclusive')} className={chipClass(gstMode === 'exclusive')}>
                  {t('pos.gstExclusive')}
                </button>
                <button type="button" aria-pressed={gstMode === 'inclusive'} onClick={() => setGstMode('inclusive')} className={chipClass(gstMode === 'inclusive')}>
                  {t('pos.gstInclusive')}
                </button>
                <div className="ml-auto flex items-center gap-3">
                  {previewPrice > 0 && (
                    <p className="text-xs text-gray-400">
                      {t('pos.lineTotal')} <span className="font-semibold text-gray-700 dark:text-gray-200">{formatINR(previewLineTotal)}</span>
                    </p>
                  )}
                  <Button data-tour="pos-lite-add-cart-btn" type="submit" leftIcon={<Plus size={16} />}>
                    {t('pos.addToCart')}
                  </Button>
                </div>
              </div>
            </Card>
          </form>

          <section data-tour="pos-lite-recent">
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('pos.recentItems')}</h3>
              <span className="text-[11px] text-gray-400">{t('pos.tapToAdd')}</span>
            </div>
            {recentItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                {t('pos.noRecentItems')}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {recentItems.map(item => (
                  <button
                    key={`${item.productId || item.productName}-${item.sellingPrice}-${item.taxRate}`}
                    type="button"
                    onClick={() => addFromRecent(item)}
                    className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 transition-colors duration-150 hover:border-gray-400 dark:hover:border-gray-500"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatINR(item.sellingPrice)}
                      {item.taxRate > 0 ? ` · ${item.taxRate}%` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {(products?.length ?? 0) > 0 && (
            <section>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('pos.fastCatalog')}</h3>
                <div className="relative w-44 sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={catalogQuery}
                    onChange={e => setCatalogQuery(e.target.value)}
                    placeholder={t('pos.searchCatalog')}
                    className="w-full h-8 pl-7 pr-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              {catalogHits.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">{t('pos.noCatalogHits')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {catalogHits.map(product => {
                    const price = getEffectivePrice(product)
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addFromCatalog(product)}
                        className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 transition-colors duration-150 hover:border-gray-400 dark:hover:border-gray-500"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatINR(price)}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {items.length > 0 && (
          <div data-tour="pos-lite-tab-cart" className="sm:hidden flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
      <Card data-tour="pos-lite-cart" className={`sm:w-[400px] w-full flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 rounded-none h-full min-h-0 max-h-full overflow-hidden ${mobileTab === 'products' ? 'hidden sm:flex' : 'flex'}`}>
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
                onClick={() => setIsPaymentOpen(true)}
                disabled={isCreating}
                title={t('pos.completeAndPrint')}
                className="sm:hidden px-3 py-1.5 bg-[#0a0a2e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0"
              >
                <Printer size={15} />
                <span>{t('pos.print')}</span>
              </button>
            )}
          </div>

          {/* Customer Selector — searchable by name/phone */}
          <CustomerSelect value={selectedCustomer} onChange={setSelectedCustomer} size="default" />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 dark:divide-gray-700">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 px-6 text-gray-400">
              <ShoppingCart size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('pos.cartEmpty')}</p>
              <p className="text-xs text-gray-400 mt-1 text-center">{t('pos.addItemsHint')}</p>
              {lastBill.length > 0 && (
                <button
                  type="button"
                  onClick={replayLastBill}
                  className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                  <RotateCcw size={14} />
                  {t('pos.repeatLastBill')}
                </button>
              )}
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                {editingItemId === item.id ? (
                  <div className="space-y-2 bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={item.productName}
                        onChange={e => handleUpdateCartItem(item.id, { productName: e.target.value })}
                        placeholder="Item Name"
                        className="h-7 text-xs font-semibold flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded"
                        title="Done editing"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Unit Price (₹)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.sellingPrice}
                          onChange={e => handleUpdateCartItem(item.id, { sellingPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full h-7 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Line Total</span>
                        <div className="h-7 flex items-center font-bold text-gray-900 dark:text-gray-100">
                          {formatINR(item.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400">
                          {formatINR(item.sellingPrice)} {item.taxRate > 0 && `(+${item.taxRate}% GST)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{formatINR(item.total)}</p>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(item.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit item line"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
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
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom Section: Discount + Totals + Complete & Print Button */}
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 pb-14 sm:pb-4 space-y-2 mt-auto">
          {items.length > 0 && (
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>{t('pos.subtotal')}</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>{formatINR(taxAmount)}</span>
                </div>
              )}
            </div>
          )}
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
          <div data-tour="pos-lite-checkout-btn" className="space-y-2">
            <Button
              onClick={() => setIsPaymentOpen(true)}
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
              className="w-full h-9 text-xs font-semibold border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              Preview &amp; Edit Bill (Live Receipt)
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
            loading={isCreating}
            disabled={method === 'cash' && !isComplete}
            className="w-full py-3.5 text-base font-bold bg-[#0a0a2e] hover:bg-[#1a1555]"
          >
            <Printer size={18} className="mr-2" />
            {t('pos.completeAndPrint')}
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
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors duration-150 ${
                    method === id
                      ? 'bg-[#0a0a2e] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon size={20} strokeWidth={method === id ? 2.2 : 1.75} />
                  <span className="text-xs font-medium">{label}</span>
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
