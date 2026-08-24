import { useState, useEffect, useRef, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { BarcodeStockUpdateModal } from './components/BarcodeStockUpdateModal'
import { ProductDetailModal, formatDisplayUnit } from './components/ProductDetailModal'
import { AiDocumentUploadModal } from './components/AiDocumentUploadModal'
import { ConsecutiveLabelModal } from './components/ConsecutiveLabelModal'
import { useProducts, useCreateProduct, useUpdateProduct, useBarcodeProductLookup, useBulkDeleteProducts } from '@/hooks/useProducts'
import { useCategories, useCreateCategory } from '@/hooks/useCategories'
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { AutoTranslatedText } from '@/components/common/AutoTranslatedText'
import { Plus, Trash2, Search, Barcode, QrCode, Grid, List, ChevronLeft, ChevronRight, MoreHorizontal, TrendingUp, AlertTriangle, Layers, Package, CheckSquare, Square, Tag, Printer, Download, Sparkles, Wand2, X, Bluetooth } from 'lucide-react'

import { formatINR } from '@/utils/currency'
import { buildCategoryOptions } from '@/utils/categoryTree'
import type { Product } from '@/types/product.types'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSettings } from '@/hooks/useSettings'
import { useLocations, useProductLocationStock, useUpsertProductLocationStock, useLocationStock } from '@/hooks/useLocations'
import { LocationSelector } from '@/components/common/LocationSelector'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import {
  generateLabelEscPos,
  generateLabelTspl,
  defaultLabelTemplate,
  PRESET_CENTERED_STANDARD,
  PRESET_RETAIL_DUAL_CODE,
  PRESET_MINIMAL_TAG,
  resolveElementText,
  type LabelData
} from '@/utils/labelPrint'
import type { LabelElement } from '@/types/settings.types'
import { drawBarcodeToCanvas, drawQrCodeToCanvas, downloadCanvasAsPng, downloadBarcodePng, encodeCode128B } from '@/utils/barcodeGenerator'
import { trackUserAction } from '@/utils/analytics'
import { GST_SLAB_OPTIONS, UNIT_OPTIONS, type UnitType } from '@/utils/productOptions'
import { isExpiringSoon, isExpired, daysUntilExpiry, formatExpiryMessage } from '@/utils/expiry'

export interface LabelSizePreset {
  id: string
  label: string
  width: number
  height: number
  description: string
}

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: '50x30', label: '50 × 30 mm', width: 50, height: 30, description: 'Standard' },
  { id: '50x25', label: '50 × 25 mm', width: 50, height: 25, description: 'Compact' },
  { id: '40x30', label: '40 × 30 mm', width: 40, height: 30, description: 'Small' },
  { id: '40x20', label: '40 × 20 mm', width: 40, height: 20, description: 'Mini' },
  { id: '60x40', label: '60 × 40 mm', width: 60, height: 40, description: 'Large' },
  { id: 'custom', label: 'Custom', width: 50, height: 30, description: 'Manual' },
]

type BarcodeType = 'CODE128' | 'EAN13' | 'QR'

interface ProductFormState {
  name: string
  categoryId: string
  supplierId: string
  barcode: string
  barcodeType: BarcodeType
  costPrice: string
  sellingPrice: string
  taxRate: string
  priceIncludesGst: boolean
  currentStock: string
  lowStockThreshold: string
  unit: UnitType
  imageURL: string
  // Optional details — never required, purely informational when filled in.
  brand: string
  description: string
  expiryDate: string
}

const BARCODE_TYPE_OPTIONS = [
  { value: 'CODE128', label: 'Code 128' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'QR', label: 'QR Code' },
]

// Generates a barcode value matching the chosen symbology so the label
// printer can render it without complaints.
const generateBarcodeValue = (type: BarcodeType): string => {
  if (type === 'EAN13') {
    // 12 random digits + EAN-13 check digit
    let digits = ''
    for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10)
    const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
    const check = (10 - (sum % 10)) % 10
    return digits + check
  }
  // CODE128 / QR accept any string — SZ prefix + timestamp + random suffix keeps it unique & scannable.
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `SZ${Date.now().toString().slice(-8)}${rand}`
}

const defaultForm: ProductFormState = {
  name: '',
  categoryId: '',
  supplierId: '',
  barcode: '',
  barcodeType: 'CODE128',
  costPrice: '',
  sellingPrice: '',
  taxRate: '0',
  priceIncludesGst: false,
  currentStock: '0',
  lowStockThreshold: '10',
  unit: 'piece',
  imageURL: '',
  brand: '',
  description: '',
  expiryDate: '',
}

const PAGE_SIZE = 8

export const ProductsPage = () => {
  const { t } = useLanguage()
  const { data: products, isLoading } = useProducts()

  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { mutate: createProduct, isPending: isCreating } = useCreateProduct()

  const { mutate: updateProduct, isPending: isUpdating } = useUpdateProduct()
  const { mutate: lookupBarcode, isPending: isLookingUp } = useBarcodeProductLookup()
  const { mutate: bulkDeleteProducts, isPending: isBulkDeleting } = useBulkDeleteProducts()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormState>(defaultForm)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [currentPage, setCurrentPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showManualBarcodeModal, setShowManualBarcodeModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [showConsecutiveModal, setShowConsecutiveModal] = useState(false)
  const [consecutiveProducts, setConsecutiveProducts] = useState<Product[]>([])
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const { data: settings } = useSettings()
  const locationFeatureEnabled = settings?.locationConfig?.enabled ?? false
  const { data: allLocations = [] } = useLocations()
  const activeLocations = allLocations.filter(l => l.isActive)
  const { data: productLocationStock = [] } = useProductLocationStock(locationFeatureEnabled ? editId : null)
  const { mutate: upsertLocationStock } = useUpsertProductLocationStock()

  // Store switcher — lets the owner browse/manage this catalog scoped to one
  // store at a time (same shared selection as POS/Scan-to-Bill, via
  // LocationSelector's localStorage key, so picking a store anywhere in the
  // app stays consistent). Products can carry different stock/price per
  // store, or be entirely absent from one — "browseStoreId" is null when the
  // feature is off or no store is picked, which falls back to every
  // product's flat currentStock/sellingPrice exactly as before.
  const [browseStoreId, setBrowseStoreId] = useState<string | null>(null)
  const [showOnlyThisStore, setShowOnlyThisStore] = useState(false)
  const { data: browseStoreStock = [] } = useLocationStock(browseStoreId)
  const browseStoreStockMap = new Map(browseStoreStock.map(r => [r.productId, r]))
  const browseStoreName = allLocations.find(l => l.id === browseStoreId)?.name ?? ''

  const getBrowseStock = (product: { id: string; currentStock: number }): number =>
    browseStoreId ? (browseStoreStockMap.get(product.id)?.stock ?? 0) : product.currentStock
  const getBrowsePrice = (product: { id: string; sellingPrice: number }): number =>
    browseStoreId ? (browseStoreStockMap.get(product.id)?.priceOverride ?? product.sellingPrice) : product.sellingPrice
  const isCarriedAtBrowseStore = (product: { id: string }): boolean =>
    !browseStoreId || browseStoreStockMap.has(product.id)
  const { status: bleStatus, deviceName: bleDeviceName, connect: connectBlePrinter, isSupported: isBleSupported, print: sendBleData } = useBlePrinter()
  const isBleConnected = bleStatus === 'connected'
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)
  const [labelQty, setLabelQty] = useState<number>(1)
  const [labelFormat, setLabelFormat] = useState<'CODE128' | 'EAN13' | 'QR'>('CODE128')
  const [selectedLabelSizeId, setSelectedLabelSizeId] = useState<string>('50x30')
  const [labelWidth, setLabelWidth] = useState<number>(50)
  const [labelHeight, setLabelHeight] = useState<number>(30)
  const [selectedLayoutPresetId, setSelectedLayoutPresetId] = useState<string>('standard')
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const activeLabelTemplate = selectedLayoutPresetId === 'dual'
    ? PRESET_RETAIL_DUAL_CODE
    : selectedLayoutPresetId === 'minimal'
    ? PRESET_MINIMAL_TAG
    : selectedLayoutPresetId === 'custom_settings' && settings?.printerConfig?.labelTemplate
    ? settings.printerConfig.labelTemplate
    : PRESET_CENTERED_STANDARD

  const openDetail = (product: Product) => {
    setDetailProduct(product)
    setIsDetailOpen(true)
  }

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return (products ?? [])
      .filter((p: Product) => p.isActive !== false && (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      ))
      .slice(0, 6)
  }, [products, search])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (isLabelModalOpen && labelProduct && canvasRef.current) {
      const payload = labelProduct.barcode || labelProduct.sku || '000000'
      if (labelFormat === 'QR') {
        drawQrCodeToCanvas(canvasRef.current, payload, 160)
      } else {
        drawBarcodeToCanvas(canvasRef.current, payload, { height: 75 })
      }
    }
  }, [isLabelModalOpen, labelProduct, labelFormat])

  // Inline "add new" mini-forms inside the product modal, so a missing
  // category/supplier doesn't force the user to abandon the form.
  const { mutate: createCategory, isPending: isCreatingCategory } = useCreateCategory()
  const { mutate: createSupplier, isPending: isCreatingSupplier } = useCreateSupplier()
  const [showInlineCategory, setShowInlineCategory] = useState(false)
  const [inlineCategoryName, setInlineCategoryName] = useState('')
  const [showInlineSupplier, setShowInlineSupplier] = useState(false)
  const [inlineSupplierName, setInlineSupplierName] = useState('')
  const [inlineSupplierPhone, setInlineSupplierPhone] = useState('')

  // Custom GST rate entry when none of the standard slabs fit.
  const [gstIsCustom, setGstIsCustom] = useState(false)

  const handleInlineCreateCategory = () => {
    if (!inlineCategoryName.trim()) return
    createCategory({ name: inlineCategoryName.trim() }, {
      onSuccess: (categoryId) => {
        toast.success('Category created')
        setForm(prev => ({ ...prev, categoryId }))
        setInlineCategoryName('')
        setShowInlineCategory(false)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create category'),
    })
  }

  const handleInlineCreateSupplier = () => {
    if (!inlineSupplierName.trim() || !inlineSupplierPhone.trim()) return
    createSupplier({ name: inlineSupplierName.trim(), phone: inlineSupplierPhone.trim() }, {
      onSuccess: (supplierId) => {
        toast.success('Supplier created')
        setForm(prev => ({ ...prev, supplierId }))
        setInlineSupplierName('')
        setInlineSupplierPhone('')
        setShowInlineSupplier(false)
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create supplier'),
    })
  }

  // F3 keyboard shortcut to open barcode stock update modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault()
        setShowBarcodeModal(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Category quick filter bar horizontal scroll logic
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current
    if (el) {
      setCanScrollLeft(el.scrollLeft > 5)
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
    }
  }

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current
    if (el) {
      const scrollAmount = direction === 'left' ? -280 : 280
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' })
      setTimeout(checkCategoryScroll, 300)
    }
  }

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (categoryScrollRef.current && (e.deltaY !== 0 || e.deltaX !== 0)) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        categoryScrollRef.current.scrollLeft += e.deltaY
      }
    }
  }

  const activeProducts = products?.filter(p => p.isActive !== false) ?? []
  const filtered = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter
    const stockHere = getBrowseStock(p)
    const matchesStock = !stockFilter ||
      (stockFilter === 'in-stock' && stockHere > p.lowStockThreshold) ||
      (stockFilter === 'low-stock' && stockHere > 0 && stockHere <= p.lowStockThreshold) ||
      (stockFilter === 'out-of-stock' && stockHere <= 0)
    const matchesStoreScope = !browseStoreId || !showOnlyThisStore || isCarriedAtBrowseStore(p)
    return matchesSearch && matchesCategory && matchesStock && matchesStoreScope
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const getCategoryName = (categoryId: string) =>
    categories?.find(c => c.id === categoryId)?.name ?? '—'
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map(p => p.id)))
    }
  }

  // Stats
  const totalInventoryValue = activeProducts.reduce((sum, p) => sum + (p.costPrice * p.currentStock), 0)
  const lowStockProducts = activeProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.lowStockThreshold)
  const outOfStockProducts = activeProducts.filter(p => p.currentStock <= 0)
  const expiringProducts = activeProducts
    .filter(p => isExpiringSoon(p.expiryDate))
    .sort((a, b) => (daysUntilExpiry(a.expiryDate) ?? 0) - (daysUntilExpiry(b.expiryDate) ?? 0))

  // Category distribution
  const categoryCounts = activeProducts.reduce<Record<string, number>>((acc, p) => {
    acc[p.categoryId] = (acc[p.categoryId] || 0) + 1
    return acc
  }, {})
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const resetForm = () => {
    setForm(defaultForm)
    setEditId(null)
    setShowInlineCategory(false)
    setInlineCategoryName('')
    setShowInlineSupplier(false)
    setInlineSupplierName('')
    setInlineSupplierPhone('')
    setGstIsCustom(false)
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const handlePrintLabel = (product: Product) => {
    setLabelProduct(product)
    setLabelFormat((product.barcodeType as 'CODE128' | 'EAN13' | 'QR') || 'CODE128')
    setLabelQty(1)

    const savedW = settings?.printerConfig?.labelWidth || 50
    const savedH = settings?.printerConfig?.labelHeight || 30
    const matched = LABEL_SIZE_PRESETS.find(p => p.id !== 'custom' && p.width === savedW && p.height === savedH)
    if (matched) {
      setSelectedLabelSizeId(matched.id)
    } else {
      setSelectedLabelSizeId('custom')
    }
    setLabelWidth(savedW)
    setLabelHeight(savedH)
    setSelectedLayoutPresetId(settings?.printerConfig?.labelTemplate ? 'custom_settings' : 'standard')
    setIsLabelModalOpen(true)
  }

  const handleSelectSizePreset = (presetId: string) => {
    setSelectedLabelSizeId(presetId)
    const preset = LABEL_SIZE_PRESETS.find(p => p.id === presetId)
    if (preset && preset.id !== 'custom') {
      setLabelWidth(preset.width)
      setLabelHeight(preset.height)
    }
  }

  const handlePrintToBlePrinter = async () => {
    if (!labelProduct) return

    if (bleStatus !== 'connected') {
      toast.error('Printer not connected. Opening Bluetooth pairing...')
      try {
        await connectBlePrinter()
      } catch {
        return
      }
    }

    const mode = settings?.printerConfig?.labelPrinterMode || 'tspl'
    const barcodeVal = labelProduct.barcode || labelProduct.sku || '000000'
    const data: LabelData = {
      businessName: settings?.businessName || 'SEZNIK RETAIL',
      productName: labelProduct.name,
      price: formatINR(labelProduct.sellingPrice),
      barcodeValue: barcodeVal,
      sku: labelProduct.sku,
    }

    try {
      const template = activeLabelTemplate
      const singleBytes = mode === 'tspl'
        ? generateLabelTspl(
            template,
            labelFormat,
            data,
            labelWidth,
            labelHeight,
            settings?.printerConfig?.labelOffsetX || 0,
            settings?.printerConfig?.labelOffsetY || 0,
            undefined,
            settings?.printerConfig?.labelDirection ?? 0,
            settings?.printerConfig?.labelBarcodeOffsetX ?? 0
          )
        : generateLabelEscPos(template, labelFormat, data)

      for (let i = 0; i < labelQty; i++) {
        await sendBleData(singleBytes)
      }
      trackUserAction('feature_print_label', { quantity: labelQty, format: labelFormat, mode: 'ble', width: labelWidth, height: labelHeight })
      toast.success(`${labelQty} label(s) sent to ${bleDeviceName || 'Seznik Dev Printer'}!`)
    } catch (err) {
      console.error('BLE Print error:', err)
      toast.error('BLE print error. Falling back to browser print.')
      handleBrowserPrintLabels()
    }
  }

  const handleBrowserPrintLabels = () => {
    if (!labelProduct) return
    trackUserAction('feature_print_label', { quantity: labelQty, format: labelFormat, mode: 'browser', width: labelWidth, height: labelHeight })
    const printWin = window.open('', '_blank')
    if (!printWin) {
      toast.error('Please allow popups to print labels')
      return
    }

    const template = activeLabelTemplate
    const barcodeVal = labelProduct.barcode || labelProduct.sku || '000000'
    const labelData: LabelData = {
      businessName: settings?.businessName || 'SEZNIK RETAIL',
      productName: labelProduct.name,
      price: formatINR(labelProduct.sellingPrice),
      barcodeValue: barcodeVal,
      sku: labelProduct.sku,
    }

    const widthMm = labelWidth
    const heightMm = labelHeight
    const offX = settings?.printerConfig?.labelOffsetX || 0
    const offY = settings?.printerConfig?.labelOffsetY || 0

    const renderElementsHtml = template.map((el: LabelElement) => {
      const align = el.align || 'center'
      const weight = el.bold ? 'font-weight:700;' : 'font-weight:400;'
      const fontKey = el.fontSize || (el.large ? 'large' : 'medium')
      const fontSizePx = fontKey === 'small' ? '9px' : fontKey === 'large' ? '13px' : fontKey === 'xlarge' ? '16px' : '11px'

      if (el.type === 'divider') {
        return `<hr style="border:none;border-top:1px solid #000;margin:2px 0;width:100%;" />`
      }

      if (el.type === 'sideBySideBarcodeQr') {
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin:2px 0;">
            <div style="flex:1;text-align:center;">
              <canvas class="bc" data-text="${barcodeVal}" data-type="${labelFormat}" style="width:28mm;height:10mm;"></canvas>
            </div>
            <div style="width:12mm;text-align:center;">
              <canvas class="qr" data-text="${barcodeVal}" data-type="QR" style="width:10mm;height:10mm;"></canvas>
            </div>
          </div>
        `
      }

      if (el.type === 'barcode' || el.type === 'qrCode') {
        const isQr = el.type === 'qrCode' || labelFormat === 'QR'
        if (isQr) {
          return `<div style="width:100%;display:flex;justify-content:${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'};margin:3px 0;"><canvas class="qr" data-text="${barcodeVal}" data-type="QR" style="width:14mm;height:14mm;display:block;"></canvas></div>`
        }
        const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
        return `<div style="width:100%;display:flex;justify-content:${justify};align-items:center;margin:3px 0;"><canvas class="bc" data-text="${barcodeVal}" data-type="${labelFormat}" style="width:44mm;height:17mm;display:block;margin:0 auto;"></canvas></div>`
      }

      const txt = resolveElementText(el, labelData)
      if (!txt) return ''
      const extraStyle = el.type === 'price' ? 'margin-top:5px;' : ''
      return `<div style="width:100%;text-align:${align};${weight}font-size:${fontSizePx};margin:1px 0;${extraStyle}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${txt}</div>`
    }).join('')

    const stickers = Array.from({ length: labelQty }).map(() => `
      <div class="sticker">
        <div class="sticker-content">
          ${renderElementsHtml}
        </div>
      </div>
    `).join('')

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Product Labels - ${labelProduct.name}</title>
        <style>
          @page { size: auto; margin: 0; }
          body { font-family: sans-serif; margin: 0; padding: 10px; background: #fff; text-align: center; }
          .grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
          .sticker { width: ${widthMm}mm; height: ${heightMm}mm; border: 1px dashed #ccc; box-sizing: border-box; page-break-inside: avoid; overflow: hidden; position: relative; }
          .sticker-content { width: 100%; height: 100%; padding: 3px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; transform: translate(${offX}mm, ${offY}mm); }
        </style>
      </head>
      <body>
        <div class="grid">${stickers}</div>
        <script>
          ${drawBarcodeToCanvas.toString()}
          ${encodeCode128B.toString()}

          document.querySelectorAll('.bc').forEach(canvas => {
            const text = canvas.getAttribute('data-text');
            const type = canvas.getAttribute('data-type');
            drawBarcodeToCanvas(canvas, text, type, { width: 240, height: 75, showText: true });
          });

          document.querySelectorAll('.qr').forEach(canvas => {
            const text = canvas.getAttribute('data-text');
            drawBarcodeToCanvas(canvas, text, 'QR', { width: 120, height: 120, showText: false });
          });

          setTimeout(() => {
            window.print();
            window.close();
          }, 400);
        </script>
      </body>
      </html>
    `)
    printWin.document.close()
  }

  const handleDownloadBarcodeImage = () => {
    if (!labelProduct) return
    const val = labelProduct.barcode || labelProduct.sku || 'barcode'
    downloadBarcodePng(labelProduct.name, val, labelFormat)
    toast.success('Barcode image downloaded!')
  }

  const openEdit = (row: Product) => {
    setForm({
      name: row.name,
      categoryId: row.categoryId,
      supplierId: row.supplierId ?? '',
      barcode: row.barcode ?? '',
      barcodeType: row.barcodeType ?? 'CODE128',
      costPrice: String(row.costPrice),
      sellingPrice: String(row.sellingPrice),
      taxRate: String(row.taxRate ?? 0),
      priceIncludesGst: row.priceIncludesGst ?? false,
      currentStock: String(row.currentStock),
      lowStockThreshold: String(row.lowStockThreshold),
      unit: row.unit,
      imageURL: row.imageURL ?? '',
      brand: row.brand ?? '',
      description: row.description ?? '',
      expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : '',
    })
    setEditId(row.id)
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.categoryId) {
      toast.error('Please fill in product name and category')
      return
    }
    if (!form.barcode.trim()) {
      toast.error('Please enter a barcode or use Auto-Generate')
      return
    }

    const taxRate = parseFloat(form.taxRate) || 0
    const enteredPrice = parseFloat(form.sellingPrice) || 0

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      supplierId: form.supplierId || undefined,
      barcode: form.barcode.trim(),
      barcodeType: form.barcodeType,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: enteredPrice,
      taxRate,
      priceIncludesGst: form.priceIncludesGst,
      currentStock: parseInt(form.currentStock) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      unit: form.unit,
      imageURL: form.imageURL || '',
      isActive: true,
      // Optional details — sent as null (not omitted) when cleared, so
      // editing a product to remove a brand/description/expiry actually
      // clears it server-side instead of leaving the old value in place.
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
    }

    if (editId) {
      updateProduct(
        { productId: editId, data: payload },
        {
          onSuccess: () => {
            toast.success('Product updated')
            setIsFormOpen(false)
            resetForm()
          },
          onError: () => toast.error('Failed to update product'),
        }
      )
    } else {
      createProduct(payload, {
        onSuccess: () => {
          toast.success('Product created')
          setIsFormOpen(false)
          resetForm()
          setCurrentPage(1)
        },
        onError: () => toast.error('Failed to create product'),
      })
    }
  }


  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected product(s)? They will be marked inactive.`)) return
    bulkDeleteProducts(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`${selectedIds.size} product(s) deleted`)
        setSelectedIds(new Set())
      },
      onError: () => toast.error('Failed to delete products'),
    })
  }

  const handleManualBarcodeUpdate = () => {
    if (!manualBarcode.trim()) {
      toast.error('Please enter a barcode')
      return
    }

    const qty = parseInt(manualQty) || 1
    if (qty < 0) {
      toast.error('Quantity must be 0 or greater')
      return
    }

    lookupBarcode(manualBarcode.trim(), {
      onSuccess: (product) => {
        if (product) {
          const newStock = product.currentStock + qty
          updateProduct(
            { productId: product.id, data: { currentStock: newStock } },
            {
              onSuccess: () => {
                toast.success(`Stock updated: ${product.name} (${product.currentStock} → ${newStock})`)
                setManualBarcode('')
                setManualQty('1')
                setShowManualBarcodeModal(false)
              },
              onError: () => toast.error('Failed to update stock'),
            }
          )
        } else {
          toast.error(`Product not found for barcode: ${manualBarcode}`)
        }
      },
      onError: () => toast.error('Failed to lookup product'),
    })
  }

  const pageTutorial = usePageTutorial('products')
  const categoryOptions = buildCategoryOptions(categories)

  return (
    <div className="p-3 sm:p-6 max-w-full overflow-x-hidden pb-32 sm:pb-6">
      <div data-tour="products-header">
        <PageHeader
          title={t('page.products')}
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button
              data-tour="add-product-btn"
              leftIcon={<Plus size={16} />}
              onClick={openCreate}
              className="shrink-0 whitespace-nowrap font-bold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('products.addProduct')}
            </Button>
          }
        />

        {/* Quick Tools Action Bar — Horizontally scrollable on all screen sizes */}
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-1 mb-4 min-w-0">
          {selectedIds.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={16} />}
              onClick={handleBulkDelete}
              loading={isBulkDeleting}
              className="shrink-0 whitespace-nowrap"
            >
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800 font-bold shrink-0 whitespace-nowrap"
            leftIcon={<Tag size={16} className="text-blue-600 dark:text-blue-400" />}
            onClick={() => {
              const targetProds = selectedIds.size > 0
                ? activeProducts.filter(p => selectedIds.has(p.id))
                : activeProducts
              setConsecutiveProducts(targetProds)
              setShowConsecutiveModal(true)
            }}
          >
            {selectedIds.size > 0 ? `Consecutive Labels (${selectedIds.size})` : 'Consecutive Billing Labels'}
          </Button>
          <Button
            variant="outline"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-800 font-bold shrink-0 whitespace-nowrap"
            leftIcon={<Sparkles size={16} className="text-purple-600 dark:text-purple-400 animate-pulse" />}
            onClick={() => setShowAiModal(true)}
          >
            SEZ AI Bulk Upload
          </Button>
          <Button
            data-tour="scan-stock-btn"
            variant="outline"
            leftIcon={<Barcode size={16} />}
            onClick={() => setShowBarcodeModal(true)}
            className="shrink-0 whitespace-nowrap"
          >
            Scan to Update Stock
          </Button>
          <Button
            variant="outline"
            leftIcon={<Barcode size={16} />}
            onClick={() => setShowManualBarcodeModal(true)}
            className="shrink-0 whitespace-nowrap"
          >
            Manual Stock Update
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div data-tour="products-search" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 shrink-0 no-scrollbar">
          <div data-tour="view-mode-toggle" className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <Grid size={14} />
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <List size={14} />
              Grid
            </button>
          </div>
          <div className="relative shrink-0">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 pr-8 py-1.5 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
            >
              <option value="">All Categories</option>
              {categoryOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div className="relative shrink-0">
            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              className="px-3 pr-8 py-1.5 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
            >
              <option value="">All Statuses</option>
              <option value="in-stock">{t('pos.inStock')}</option>
              <option value="low-stock">{t('pos.lowStock')}</option>
              <option value="out-of-stock">{t('pos.outOfStock')}</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <div data-tour="search-input" className="relative w-full sm:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={16} />
          <Input
            placeholder={t('products.searchPlaceholder')}
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setShowSearchSuggestions(true)
              setCurrentPage(1)
            }}
            onFocus={() => setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 250)}
            className="pl-9 w-full text-xs h-9"
          />
          {showSearchSuggestions && search.trim().length > 0 && searchSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 overflow-hidden">
              <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                Matching Products ({searchSuggestions.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searchSuggestions.map((p: Product) => {
                  const stock = getBrowseStock(p)
                  const price = getBrowsePrice(p)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSearch(p.name)
                        setShowSearchSuggestions(false)
                        setCurrentPage(1)
                      }}
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>• {p.barcode}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatINR(price)}</span>
                        <span className={`block text-[10px] ${stock <= 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {stock <= 0 ? 'Out of Stock' : `${stock} in stock`}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Store switcher — browse/manage this catalog scoped to one store at a
          time. Only rendered when multi-store inventory is enabled and at
          least one active store exists. */}
      {locationFeatureEnabled && activeLocations.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <LocationSelector onChange={setBrowseStoreId} />
          {browseStoreId && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyThisStore}
                onChange={e => setShowOnlyThisStore(e.target.checked)}
                className="rounded"
              />
              Only show products carried at {browseStoreName}
            </label>
          )}
        </div>
      )}

      {/* Category Quick Filter Pills (Fully Horizontal Scrollable on Mobile, Tablet & Desktop) */}
      <div className="relative mb-4 group min-w-0">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollCategories('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 dark:bg-gray-800/95 shadow-md rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all -ml-2"
            aria-label="Scroll Left"
          >
            <ChevronLeft size={15} />
          </button>
        )}

        <div
          ref={categoryScrollRef}
          onScroll={checkCategoryScroll}
          onWheel={handleCategoryWheel}
          className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 max-w-full no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x cursor-grab active:cursor-grabbing select-none"
        >
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              !categoryFilter
                ? 'bg-[#0a0a2e] text-white shadow-xs ring-2 ring-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Categories ({activeProducts.length})
          </button>
          {categoryOptions.map(c => {
            const count = activeProducts.filter(p => p.categoryId === c.value).length
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  categoryFilter === c.value
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {c.label} ({count})
              </button>
            )
          })}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollCategories('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 dark:bg-gray-800/95 shadow-md rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all -mr-2"
            aria-label="Scroll Right"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Product List - Left */}
        <div data-tour="products-table" className="xl:col-span-3">
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Inventory Catalog</h3>
            </div>

            {isLoading ? (
              <div className="p-4"><TableSkeleton rows={6} columns={7} /></div>
            ) : viewMode === 'list' ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-4 w-10">
                          <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            {selectedIds.size === paginated.length && paginated.length > 0
                              ? <CheckSquare size={16} className="text-blue-600" />
                              : <Square size={16} />}
                          </button>
                        </th>
                        <th className="px-6 py-4">Product Detail</th>
                        <th className="px-6 py-4">SKU / Barcode</th>
                        <th className="px-6 py-4">{t('common.category')}</th>
                        <th className="px-6 py-4">{t('products.stockLevel')}</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {paginated.map(product => {
                        const storeStock = getBrowseStock(product)
                        const storePrice = getBrowsePrice(product)
                        const stockPercent = Math.min((storeStock / (product.lowStockThreshold * 3)) * 100, 100)
                        const isLowStock = storeStock > 0 && storeStock <= product.lowStockThreshold
                        const isOutOfStock = storeStock <= 0
                        return (
                          <tr
                            key={product.id}
                            onClick={() => openDetail(product)}
                            className={`cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-800/80 transition-colors ${selectedIds.has(product.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                          >
                            <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => toggleSelect(product.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                {selectedIds.has(product.id)
                                  ? <CheckSquare size={16} className="text-blue-600" />
                                  : <Square size={16} />}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                  {product.imageURL ? (
                                    <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package size={20} className="text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                      {product.name}
                                    </p>
                                    {isExpiringSoon(product.expiryDate) && (
                                      <span
                                        title={formatExpiryMessage(product.expiryDate)}
                                        className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                                          isExpired(product.expiryDate)
                                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}
                                      >
                                        {isExpired(product.expiryDate) ? t('products.expired') : t('products.expiringSoonBadge')}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-400">{formatDisplayUnit(product.unit)}{product.brand ? ` · ${product.brand}` : ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{product.sku}</span>
                              {product.barcode && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Barcode size={12} className="text-gray-400" />
                                  <span className="text-xs text-gray-400">{product.barcode}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="info">
                                <AutoTranslatedText text={getCategoryName(product.categoryId)} />
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`text-sm font-semibold ${
                                  isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {storeStock} Units
                                </span>
                                {browseStoreId && (
                                  <span className="text-[10px] text-gray-400">at {browseStoreName}</span>
                                )}
                                <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${stockPercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-base font-bold text-blue-600">{formatINR(storePrice)}</span>
                              {browseStoreId && storePrice !== product.sellingPrice && (
                                <p className="text-[10px] text-gray-400 line-through">{formatINR(product.sellingPrice)}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePrintLabel(product) }}
                                  title="Print label"
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                  <Tag size={16} className="text-gray-400" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEdit(product) }}
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                  <MoreHorizontal size={18} className="text-gray-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Showing {paginated.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} products
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Grid View */
              <div className="p-3 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {paginated.map(product => (
                    <Card key={product.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between" onClick={() => openDetail(product)}>
                      <div>
                        <div className="w-full h-28 sm:h-40 rounded-lg bg-gray-100 dark:bg-gray-700 mb-2 sm:mb-3 overflow-hidden relative group">
                          {product.imageURL ? (
                            <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={28} className="text-gray-300" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePrintLabel(product) }}
                            title="Print Label"
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:text-blue-600 shadow-md transition-all active:scale-95"
                          >
                            <Tag size={14} />
                          </button>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-400 font-mono truncate">{product.sku}</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 line-clamp-1">
                          {product.name}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <Badge variant={
                          product.currentStock <= 0 ? 'danger' :
                          product.currentStock <= product.lowStockThreshold ? 'warning' : 'success'
                        }>
                          {product.currentStock <= 0 ? 'Out of Stock' : `${product.currentStock} left`}
                        </Badge>
                        <span className="text-sm sm:text-base font-bold text-blue-600">{formatINR(product.sellingPrice)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package size={48} className="mb-4 opacity-30" />
                <p className="text-sm">{search ? 'No products match your search' : 'No products yet. Add your first product!'}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar - Stats */}
        <div className="space-y-6">
          {/* Total Inventory Value */}
          <Card data-tour="inventory-value-widget" className="p-5 sm:p-6 bg-gradient-to-br from-blue-700 to-sky-500 text-white overflow-hidden relative min-w-0">
            <div className="relative z-10 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 truncate">{t('products.totalInventoryValue')}</p>
              <p
                className={`font-black mt-1.5 tracking-tight break-words truncate ${
                  totalInventoryValue >= 100000000
                    ? 'text-xl sm:text-2xl xl:text-2xl'
                    : totalInventoryValue >= 10000000
                    ? 'text-2xl sm:text-3xl'
                    : totalInventoryValue >= 1000000
                    ? 'text-2xl sm:text-3xl'
                    : 'text-3xl'
                }`}
                title={formatINR(totalInventoryValue)}
              >
                {formatINR(totalInventoryValue)}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] bg-white/20 w-fit px-2.5 py-1 rounded-full font-bold">
                <TrendingUp size={12} />
                {activeProducts.length} products
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              <Layers size={96} />
            </div>
          </Card>

          {/* Stock Alerts */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2 mb-4">
              <AlertTriangle size={18} className="text-red-500" />
              {t('products.stockAlerts')}
            </h4>
            <div className="space-y-3">
              {lowStockProducts.slice(0, 3).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500">
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{product.name}</p>
                    <p className="text-[10px] text-amber-600 font-medium">Low: {product.currentStock} left</p>
                  </div>
                  <button
                    onClick={() => openEdit(product)}
                    className="text-blue-600 text-[10px] font-bold uppercase tracking-wider hover:underline"
                  >
                    Restock
                  </button>
                </div>
              ))}
              {outOfStockProducts.slice(0, 2).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{product.name}</p>
                    <p className="text-[10px] text-red-600 font-medium">Critical: Out of stock</p>
                  </div>
                  <button
                    onClick={() => openEdit(product)}
                    className="text-blue-600 text-[10px] font-bold uppercase tracking-wider hover:underline"
                  >
                    Restock
                  </button>
                </div>
              ))}
              {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">All stock levels healthy</p>
              )}
            </div>
          </Card>

          {/* Expiring Soon */}
          {expiringProducts.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-500" />
                {t('products.expiringSoon')}
              </h4>
              <div className="space-y-3">
                {expiringProducts.slice(0, 3).map(product => {
                  const expired = isExpired(product.expiryDate)
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                        expired ? 'bg-red-50 dark:bg-red-900/20 border-red-500' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{product.name}</p>
                        <p className={`text-[10px] font-medium ${expired ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatExpiryMessage(product.expiryDate)}
                        </p>
                      </div>
                      <button
                        onClick={() => openEdit(product)}
                        className="text-blue-600 text-[10px] font-bold uppercase tracking-wider hover:underline"
                      >
                        {t('action.edit')}
                      </button>
                    </div>
                  )
                })}
                {expiringProducts.length > 3 && (
                  <p className="text-[10px] text-gray-400 text-center">+{expiringProducts.length - 3} more</p>
                )}
              </div>
            </Card>
          )}

          {/* Top Categories */}
          <Card className="p-6">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-4">Top Categories</h4>
            <div className="space-y-3">
              {topCategories.map(([catId, count]) => {
                const total = activeProducts.length
                const percent = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={catId}>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{getCategoryName(catId)}</span>
                      <span className="text-gray-900 dark:text-gray-100">{percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Product Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm() }}
        title={editId ? t('products.editProduct') : t('products.addProduct')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              {t('action.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.name.trim() || !form.categoryId}
            >
              {editId ? t('action.update') : t('action.create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Product Image Upload */}
          <div>
            <ImageUpload
              label={t('products.productImage')}
              value={form.imageURL}
              onChange={url => setForm(prev => ({ ...prev, imageURL: url }))}
              previewSize="md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.productName')} *
              <FieldInfo textKey="tip.product.name" />
            </label>
            <Input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Basmati Rice 1kg"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('products.category')} *
                  <FieldInfo textKey="tip.product.category" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineCategory(v => !v)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  {showInlineCategory ? <X size={11} /> : <Plus size={11} />}
                  {showInlineCategory ? t('action.close') : t('products.newCategory')}
                </button>
              </div>
              <Select
                options={categoryOptions}
                placeholder={t('products.selectCategory')}
                value={form.categoryId}
                onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
              />
              {showInlineCategory && (
                <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex gap-2">
                  <Input
                    value={inlineCategoryName}
                    onChange={e => setInlineCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="h-9 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleInlineCreateCategory() }}
                  />
                  <Button
                    size="sm"
                    onClick={handleInlineCreateCategory}
                    loading={isCreatingCategory}
                    disabled={!inlineCategoryName.trim()}
                    className="flex-shrink-0"
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('products.supplier')}
                  <FieldInfo textKey="tip.product.supplier" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineSupplier(v => !v)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  {showInlineSupplier ? <X size={11} /> : <Plus size={11} />}
                  {showInlineSupplier ? t('action.close') : t('products.newSupplier')}
                </button>
              </div>
              <Select
                options={[
                  { value: '', label: 'None' },
                  ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
                ]}
                placeholder={t('products.selectSupplier')}
                value={form.supplierId}
                onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
              />
              {showInlineSupplier && (
                <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-2">
                  <Input
                    value={inlineSupplierName}
                    onChange={e => setInlineSupplierName(e.target.value)}
                    placeholder="Supplier name"
                    className="h-9 text-sm"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={inlineSupplierPhone}
                      onChange={e => setInlineSupplierPhone(e.target.value)}
                      placeholder="Phone number"
                      className="h-9 text-sm"
                      onKeyDown={e => { if (e.key === 'Enter') handleInlineCreateSupplier() }}
                    />
                    <Button
                      size="sm"
                      onClick={handleInlineCreateSupplier}
                      loading={isCreatingSupplier}
                      disabled={!inlineSupplierName.trim() || !inlineSupplierPhone.trim()}
                      className="flex-shrink-0"
                    >
                      {t('action.add')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.barcode')} *
              <FieldInfo textKey="tip.product.barcode" />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={form.barcode}
                onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
                placeholder="Scan, type, or auto-generate"
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select
                  options={BARCODE_TYPE_OPTIONS}
                  value={form.barcodeType}
                  onChange={e => setForm(prev => ({ ...prev, barcodeType: e.target.value as BarcodeType }))}
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(prev => ({ ...prev, barcode: generateBarcodeValue(prev.barcodeType) }))}
                  leftIcon={<Wand2 size={14} />}
                  className="flex-shrink-0 whitespace-nowrap"
                >
                  {t('products.autoGenerate')}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {t('products.barcodeHelp')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('products.costPrice')}
                <FieldInfo textKey="tip.product.costPrice" />
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('products.sellingPrice')} *
                  <FieldInfo textKey="tip.product.sellingPrice" />
                </label>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, priceIncludesGst: false }))}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${!form.priceIncludesGst ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}
                  >
                    {t('products.exclGst')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, priceIncludesGst: true }))}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${form.priceIncludesGst ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}
                  >
                    {t('products.inclGst')}
                  </button>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={e => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                placeholder="0.00"
              />
              {(() => {
                const rate = parseFloat(form.taxRate) || 0
                const price = parseFloat(form.sellingPrice) || 0
                if (!price || !rate) return null
                if (form.priceIncludesGst) {
                  const base = price / (1 + rate / 100)
                  const gst = price - base
                  return <p className="text-[11px] text-gray-400 mt-1">Base ₹{base.toFixed(2)} + GST ₹{gst.toFixed(2)} = ₹{price.toFixed(2)}</p>
                } else {
                  const gst = price * rate / 100
                  return <p className="text-[11px] text-gray-400 mt-1">Base ₹{price.toFixed(2)} + GST ₹{gst.toFixed(2)} = ₹{(price + gst).toFixed(2)} incl.</p>
                }
              })()}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.taxRate')}
              <FieldInfo textKey="tip.product.gstRate" />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                options={GST_SLAB_OPTIONS}
                value={gstIsCustom ? 'custom' : (GST_SLAB_OPTIONS.some(o => o.value === form.taxRate) ? form.taxRate : 'custom')}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    setGstIsCustom(true)
                  } else {
                    setGstIsCustom(false)
                    setForm(prev => ({ ...prev, taxRate: e.target.value }))
                  }
                }}
                className="flex-1"
              />
              {(gstIsCustom || !GST_SLAB_OPTIONS.some(o => o.value === form.taxRate)) && (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.taxRate}
                  onChange={e => setForm(prev => ({ ...prev, taxRate: e.target.value }))}
                  placeholder="Custom %"
                  className="sm:w-32"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('products.currentStock')}
                <FieldInfo textKey="tip.product.currentStock" />
              </label>
              <Input
                type="number"
                value={form.currentStock}
                onChange={e => setForm(prev => ({ ...prev, currentStock: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('products.lowStockThreshold')}
                <FieldInfo textKey="tip.product.lowStockThreshold" />
              </label>
              <Input
                type="number"
                value={form.lowStockThreshold}
                onChange={e => setForm(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.unit')}
              <FieldInfo textKey="tip.product.unit" />
            </label>
            <Select
              options={UNIT_OPTIONS}
              value={form.unit}
              onChange={e => setForm(prev => ({ ...prev, unit: e.target.value as UnitType }))}
            />
          </div>

          {/* Stock by Location — only shown when multi-location inventory is enabled */}
          {locationFeatureEnabled && activeLocations.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                {t('locations.stockAtLocation') || 'Stock by Location'}
              </p>
              {!editId ? (
                <p className="text-xs text-gray-400 italic">
                  Save this product first, then come back to set its stock per location.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeLocations.map(loc => {
                    const row = productLocationStock.find(r => r.locationId === loc.id)
                    return (
                      <div key={loc.id} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-28 truncate shrink-0">
                          {loc.name}
                        </span>
                        <input
                          type="number"
                          defaultValue={row?.stock ?? 0}
                          onBlur={e => upsertLocationStock({
                            productId: editId,
                            locationId: loc.id,
                            data: { stock: Number(e.target.value) || 0 },
                          })}
                          placeholder="Stock"
                          className="w-24 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                        <input
                          type="number"
                          defaultValue={row?.priceOverride ?? ''}
                          onBlur={e => upsertLocationStock({
                            productId: editId,
                            locationId: loc.id,
                            data: { priceOverride: e.target.value === '' ? null : Number(e.target.value) },
                          })}
                          placeholder={`Price (default ${form.sellingPrice || '0'})`}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Additional Details — entirely optional, never validated as required */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
              {t('products.additionalDetails')} <span className="font-normal">({t('common.optional')})</span>
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('products.brand')}
                  </label>
                  <Input
                    value={form.brand}
                    onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder={t('products.brandPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t('products.expiryDate')}
                    <FieldInfo textKey="tip.product.expiryDate" />
                  </label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t('products.description')}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('products.descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Barcode Stock Update Modal */}
      <BarcodeStockUpdateModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
      />

      {/* Manual Barcode Stock Update Modal */}
      <Modal
        isOpen={showManualBarcodeModal}
        onClose={() => { setShowManualBarcodeModal(false); setManualBarcode(''); setManualQty('1') }}
        title="Manual Stock Update"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Enter Barcode Manually</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Type or paste the barcode to update stock quantity</p>
          </div>

          <div className="space-y-4">
            <Input
              label="Barcode"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              placeholder="Enter or paste barcode"
              autoFocus
            />

            <Input
              label="Quantity to Add"
              type="number"
              min="0"
              value={manualQty}
              onChange={e => setManualQty(e.target.value)}
              placeholder="1"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="primary"
              onClick={handleManualBarcodeUpdate}
              loading={isLookingUp}
              disabled={!manualBarcode || isLookingUp}
              className="flex-1"
            >
              Update Stock
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowManualBarcodeModal(false); setManualBarcode(''); setManualQty('1') }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product Barcode & Label Printer Modal */}
      <Modal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        title={`Print Label: ${labelProduct?.name || ''}`}
        size="lg"
      >
        {labelProduct && (
          <div className="space-y-6">
            {/* Printer Connection Status Banner */}
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              bleStatus === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : bleStatus === 'connecting'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  bleStatus === 'connected'
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : bleStatus === 'connecting'
                    ? 'bg-blue-500 text-white animate-spin'
                    : 'bg-amber-500 text-white'
                }`}>
                  <Bluetooth size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {bleStatus === 'connected' ? 'Connected Printer' : bleStatus === 'connecting' ? 'Connecting Printer...' : 'No Printer Connected'}
                    </span>
                    {bleStatus === 'connected' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 text-[10px] font-bold">
                        READY
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium opacity-90 mt-0.5">
                    {bleStatus === 'connected'
                      ? (bleDeviceName || 'Seznik Dev 2-in-1 Dual Printer')
                      : 'Connect your Seznik Dev Printer via Bluetooth to print labels directly.'}
                  </p>
                </div>
              </div>

              {bleStatus !== 'connected' && isBleSupported && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Bluetooth size={14} />}
                  onClick={() => connectBlePrinter()}
                  loading={bleStatus === 'connecting'}
                  className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-sm"
                >
                  Connect Printer
                </Button>
              )}
            </div>

            {/* Product Summary Header */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/60">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Product</p>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{labelProduct.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {labelProduct.sku} | Price: {formatINR(labelProduct.sellingPrice)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 block font-mono">Barcode Value</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 font-mono">{labelProduct.barcode || labelProduct.sku}</span>
              </div>
            </div>

            {/* Label Dimensions Preset Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={13} className="text-blue-500" />
                  Label Sticker Size
                </label>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {labelWidth}mm × {labelHeight}mm
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {LABEL_SIZE_PRESETS.map(p => {
                  const isSelected = selectedLabelSizeId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectSizePreset(p.id)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30 ring-2 ring-blue-400/40'
                          : 'bg-white dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{p.description}</div>
                    </button>
                  )
                })}
              </div>

              {/* Custom Size Inputs (Shown when Custom is selected) */}
              {selectedLabelSizeId === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 mt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Width (mm)
                    </label>
                    <Input
                      type="number"
                      min="20"
                      max="110"
                      value={String(labelWidth)}
                      onChange={e => setLabelWidth(Math.max(10, parseInt(e.target.value) || 50))}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Height (mm)
                    </label>
                    <Input
                      type="number"
                      min="15"
                      max="150"
                      value={String(labelHeight)}
                      onChange={e => setLabelHeight(Math.max(10, parseInt(e.target.value) || 30))}
                      placeholder="30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Label Layout Template Preset Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-blue-500" />
                Layout Template Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'standard', label: 'Standard', desc: 'Store + Name + Barcode + Price' },
                  { id: 'dual', label: 'Dual Code', desc: 'Barcode + QR Side-by-Side' },
                  { id: 'minimal', label: 'Minimal', desc: 'Name + Barcode + Price' },
                  { id: 'custom_settings', label: 'From Settings', desc: 'Custom Template' },
                ].map(tmpl => {
                  const isSelected = selectedLayoutPresetId === tmpl.id
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedLayoutPresetId(tmpl.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 border-blue-500 dark:border-blue-600 text-blue-900 dark:text-blue-100 ring-2 ring-blue-400/30 font-semibold'
                          : 'bg-white dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{tmpl.label}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-400 mt-0.5 leading-tight line-clamp-1">{tmpl.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Interactive Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Label Format (Barcode / QR)
                </label>
                <Select
                  options={[
                    { value: 'CODE128', label: 'CODE128 (Standard Barcode)' },
                    { value: 'EAN13', label: 'EAN13 (Retail Barcode)' },
                    { value: 'QR', label: 'QR Code (2D Code)' },
                  ]}
                  value={labelFormat}
                  onChange={e => setLabelFormat(e.target.value as 'CODE128' | 'EAN13' | 'QR')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Print Quantity (Number of Labels)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={String(labelQty)}
                  onChange={e => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="1"
                />
              </div>
            </div>

            {/* Live Canvas Sticker Preview */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-300 dark:border-gray-600 relative overflow-hidden">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Live Sticker Preview ({labelWidth}mm × {labelHeight}mm)</span>
              <div
                className="w-[260px] p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md flex flex-col justify-start items-stretch gap-1 min-h-[140px] relative overflow-hidden"
                style={{
                  minHeight: `${Math.max(110, Math.round(260 * (labelHeight / labelWidth)))}px`,
                  transform: `translate(${settings?.printerConfig?.labelOffsetX || 0}px, ${settings?.printerConfig?.labelOffsetY || 0}px)`,
                }}
              >
                {activeLabelTemplate.map((el: LabelElement) => {
                  const alignClass = el.align === 'left' ? 'text-left w-full' : el.align === 'right' ? 'text-right w-full' : 'text-center w-full'
                  const fontKey = el.fontSize || (el.large ? 'large' : 'medium')
                  const fontClass = fontKey === 'small' ? 'text-[9px]' : fontKey === 'large' ? 'text-sm text-blue-600 dark:text-blue-400' : fontKey === 'xlarge' ? 'text-base text-blue-600 dark:text-blue-400 font-extrabold' : 'text-xs text-gray-700 dark:text-gray-200'

                  if (el.type === 'divider') {
                    return <hr key={el.id} className="border-t border-gray-300 dark:border-gray-600 my-1 w-full" />
                  }

                  if (el.type === 'sideBySideBarcodeQr') {
                    return (
                      <div key={el.id} className="flex items-center justify-between w-full my-1 gap-1">
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <canvas ref={canvasRef} className="my-0.5 max-w-full h-auto" />
                        </div>
                        <div className="w-9 flex items-center justify-center flex-shrink-0">
                          <QrCode size={24} className="text-slate-900 dark:text-white" />
                        </div>
                      </div>
                    )
                  }

                  if (el.type === 'barcode' || el.type === 'qrCode') {
                    if (el.type === 'qrCode' || labelFormat === 'QR') {
                      return (
                        <div key={el.id} className="w-full flex justify-center items-center my-1">
                          <QrCode size={34} className="text-slate-900 dark:text-white" />
                        </div>
                      )
                    }
                    return (
                      <div key={el.id} className="w-full flex justify-center items-center my-1">
                        <canvas ref={canvasRef} className="max-w-[95%] h-auto inline-block" />
                      </div>
                    )
                  }

                  const labelData: LabelData = {
                    businessName: settings?.businessName || 'SEZNIK RETAIL',
                    productName: labelProduct.name,
                    price: formatINR(labelProduct.sellingPrice),
                    barcodeValue: labelProduct.barcode || labelProduct.sku || '000000',
                    sku: labelProduct.sku,
                  }
                  const text = resolveElementText(el, labelData)
                  if (!text) return null
                  const priceExtra = el.type === 'price' ? 'mt-auto pt-1 font-bold text-gray-900 dark:text-white' : ''
                  return (
                    <div
                      key={el.id}
                      className={`${alignClass} truncate ${el.bold ? 'font-bold' : ''} ${fontClass} ${priceExtra}`}
                    >
                      {text}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                leftIcon={<Printer size={16} />}
                onClick={handlePrintToBlePrinter}
                className="flex-1 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white shadow-md shadow-sky-500/20 py-2.5"
              >
                Print to Seznik Dev Printer ({labelQty})
              </Button>
              <Button
                variant="outline"
                leftIcon={<Printer size={16} />}
                onClick={handleBrowserPrintLabels}
                className="flex-1 py-2.5"
              >
                Print / PDF ({labelQty} Stickers)
              </Button>
              <Button
                variant="ghost"
                leftIcon={<Download size={16} />}
                onClick={handleDownloadBarcodeImage}
                className="py-2.5"
                title="Download Barcode / QR Image"
              >
                Download PNG
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Comprehensive Product Details Drawer / Modal */}
      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={detailProduct}
        categoryName={detailProduct ? getCategoryName(detailProduct.categoryId) : undefined}
        supplierName={detailProduct ? (suppliers?.find(s => s.id === detailProduct.supplierId)?.name || 'None') : undefined}
        selectedStoreId={browseStoreId}
        selectedStoreName={browseStoreName}
        onEdit={openEdit}
        onDelete={(p) => {
          if (confirm(`Delete product "${p.name}"?`)) {
            bulkDeleteProducts([p.id], {
              onSuccess: () => toast.success('Product deleted'),
              onError: () => toast.error('Failed to delete product'),
            })
          }
        }}
        onPrintLabel={handlePrintLabel}
      />

      <AiDocumentUploadModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />

      <ConsecutiveLabelModal
        isOpen={showConsecutiveModal}
        onClose={() => setShowConsecutiveModal(false)}
        selectedProducts={consecutiveProducts}
        allProducts={activeProducts}
      />

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="products"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
