import { useState, useEffect, useRef } from 'react'
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
import { useProducts, useCreateProduct, useUpdateProduct, useBarcodeProductLookup, useBulkDeleteProducts } from '@/hooks/useProducts'
import { useCategories, useCreateCategory } from '@/hooks/useCategories'
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { Plus, Trash2, Search, Barcode, Grid, List, ChevronLeft, ChevronRight, MoreHorizontal, TrendingUp, AlertTriangle, Layers, Package, CheckSquare, Square, Tag, Printer, Download, Sparkles, Wand2, X } from 'lucide-react'

import { formatINR } from '@/utils/currency'
import { buildCategoryOptions } from '@/utils/categoryTree'
import type { Product } from '@/types/product.types'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { generateLabelEscPos, generateLabelTspl, defaultLabelTemplate } from '@/utils/labelPrint'
import { drawBarcodeToCanvas, downloadBarcodePng, encodeCode128B } from '@/utils/barcodeGenerator'


type UnitType = 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'
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
}

const BARCODE_TYPE_OPTIONS = [
  { value: 'CODE128', label: 'Code 128' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'QR', label: 'QR Code' },
]

// Standard Indian GST slabs, plus a custom escape hatch for anything unusual.
const GST_SLAB_OPTIONS = [
  { value: '0', label: '0% — Exempt' },
  { value: '3', label: '3% — Gold, precious stones' },
  { value: '5', label: '5% — Essentials' },
  { value: '12', label: '12% — Standard' },
  { value: '18', label: '18% — Standard' },
  { value: '28', label: '28% — Luxury' },
  { value: 'custom', label: 'Custom rate…' },
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

const UNIT_OPTIONS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'liter', label: 'Liter' },
  { value: 'meter', label: 'Meter' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'box', label: 'Box' },
]

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
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormState>(defaultForm)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [currentPage, setCurrentPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showManualBarcodeModal, setShowManualBarcodeModal] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualQty, setManualQty] = useState('1')
  const { data: settings } = useSettings()
  const { status: bleStatus, print: sendBleData } = useBlePrinter()
  const isBleConnected = bleStatus === 'connected'
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)
  const [labelQty, setLabelQty] = useState<number>(1)
  const [labelFormat, setLabelFormat] = useState<'CODE128' | 'EAN13' | 'QR'>('CODE128')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (isLabelModalOpen && labelProduct && canvasRef.current) {
      const payload = labelProduct.barcode || labelProduct.sku || '000000'
      drawBarcodeToCanvas(canvasRef.current, payload, labelFormat, { width: 240, height: 75, showText: true })
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

  const activeProducts = products?.filter(p => p.isActive !== false) ?? []
  const filtered = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = !categoryFilter || p.categoryId === categoryFilter
    const matchesStock = !stockFilter ||
      (stockFilter === 'in-stock' && p.currentStock > p.lowStockThreshold) ||
      (stockFilter === 'low-stock' && p.currentStock > 0 && p.currentStock <= p.lowStockThreshold) ||
      (stockFilter === 'out-of-stock' && p.currentStock <= 0)
    return matchesSearch && matchesCategory && matchesStock
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
    setIsLabelModalOpen(true)
  }

  const handlePrintToBlePrinter = async () => {
    if (!labelProduct) return
    const mode = settings?.printerConfig?.labelPrinterMode || 'tspl'
    const barcodeVal = labelProduct.barcode || labelProduct.sku || '000000'
    const data = {
      businessName: settings?.businessName || 'SEZNIK RETAIL',
      productName: labelProduct.name,
      price: formatINR(labelProduct.sellingPrice),
      barcodeValue: barcodeVal,
    }

    try {
      const template = settings?.printerConfig?.labelTemplate || defaultLabelTemplate
      const singleBytes = mode === 'tspl'
        ? generateLabelTspl(template, labelFormat, data, settings?.printerConfig?.labelWidth || 50, settings?.printerConfig?.labelHeight || 30)
        : generateLabelEscPos(template, labelFormat, data)

      for (let i = 0; i < labelQty; i++) {
        await sendBleData(singleBytes)
      }
      toast.success(`${labelQty} label(s) sent to Seznik Dev Printer!`)
    } catch (err) {
      console.error('BLE Print error:', err)
      toast.error('BLE print error. Falling back to browser print.')
      handleBrowserPrintLabels()
    }
  }

  const handleBrowserPrintLabels = () => {
    if (!labelProduct) return
    const printWin = window.open('', '_blank')
    if (!printWin) {
      toast.error('Please allow popups to print labels')
      return
    }

    const barcodeVal = labelProduct.barcode || labelProduct.sku || '000000'
    const priceStr = formatINR(labelProduct.sellingPrice)
    const storeName = settings?.businessName || 'SEZNIK RETAIL'

    const stickers = Array.from({ length: labelQty }).map(() => `
      <div class="sticker">
        <div class="store">${storeName}</div>
        <div class="name">${labelProduct.name}</div>
        <canvas class="bc" data-text="${barcodeVal}" data-type="${labelFormat}"></canvas>
        <div class="price">${priceStr}</div>
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
          .sticker { width: 50mm; height: 30mm; border: 1px dashed #ccc; padding: 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; align-items: center; page-break-inside: avoid; }
          .store { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; }
          .name { font-size: 10px; font-weight: bold; margin: 1px 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 45mm; }
          .price { font-size: 12px; font-weight: 800; color: #2563eb; }
          .bc { width: 44mm; height: 16mm; }
        </style>
      </head>
      <body>
        <div class="grid">${stickers}</div>
        <script>
          ${drawBarcodeToCanvas.toString()}
          ${encodeCode128B.toString()}
          const CODE128_PATTERNS = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "202121", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "411212", "411122", "411221", "421112", "421211", "212141", "214121", "412112", "421211", "411123", "411321", "421121", "412121", "211142", "211241", "211421", "214112", "214211", "241112", "241211", "412112", "421112", "412211", "211133", "211331", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "411212", "411122", "411221", "421112", "421211", "212141", "214121", "412112", "421112"];
          const START_B = "211214";
          const STOP = "2331112";

          document.querySelectorAll('.bc').forEach(canvas => {
            const text = canvas.getAttribute('data-text');
            const type = canvas.getAttribute('data-type');
            drawBarcodeToCanvas(canvas, text, type, { width: 240, height: 75, showText: true });
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
      priceIncludesGst: false,
      currentStock: String(row.currentStock),
      lowStockThreshold: String(row.lowStockThreshold),
      unit: row.unit,
      imageURL: row.imageURL ?? '',
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
    const baseSellingPrice = form.priceIncludesGst && taxRate > 0
      ? enteredPrice / (1 + taxRate / 100)
      : enteredPrice

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      supplierId: form.supplierId || undefined,
      barcode: form.barcode.trim(),
      barcodeType: form.barcodeType,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: baseSellingPrice,
      taxRate,
      currentStock: parseInt(form.currentStock) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      unit: form.unit,
      imageURL: form.imageURL || '',
      isActive: true,
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
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              {selectedIds.size > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 size={16} />}
                  onClick={handleBulkDelete}
                  loading={isBulkDeleting}
                >
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
              <Button
                data-tour="scan-stock-btn"
                variant="outline"
                leftIcon={<Barcode size={16} />}
                onClick={() => setShowBarcodeModal(true)}
              >
                Scan to Update Stock
              </Button>
              <Button
                variant="outline"
                leftIcon={<Barcode size={16} />}
                onClick={() => setShowManualBarcodeModal(true)}
              >
                Manual Stock Update
              </Button>
              <Button data-tour="add-product-btn" leftIcon={<Plus size={16} />} onClick={openCreate}>
                {t('products.addProduct')}
              </Button>
            </div>
          }
        />
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

        <div data-tour="search-input" className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder={t('products.searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="pl-9 w-full text-xs h-9"
          />
        </div>
      </div>

      {/* Category Quick Filter Pills (Horizontal Scrollable on Mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 max-w-full no-scrollbar">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
            !categoryFilter
              ? 'bg-[#0a0a2e] text-white shadow-xs'
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
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === c.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {c.label} ({count})
            </button>
          )
        })}
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
                        const stockPercent = Math.min((product.currentStock / (product.lowStockThreshold * 3)) * 100, 100)
                        const isLowStock = product.currentStock > 0 && product.currentStock <= product.lowStockThreshold
                        const isOutOfStock = product.currentStock <= 0
                        return (
                          <tr key={product.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedIds.has(product.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                            <td className="px-4 py-4 w-10">
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
                                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{product.name}</p>
                                  <p className="text-[11px] text-gray-400">{product.unit}</p>
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
                              <Badge variant="info">{getCategoryName(product.categoryId)}</Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={`text-sm font-semibold ${
                                  isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {product.currentStock} Units
                                </span>
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
                              <span className="text-base font-bold text-blue-600">{formatINR(product.sellingPrice)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handlePrintLabel(product)}
                                  title="Print label"
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                  <Tag size={16} className="text-gray-400" />
                                </button>
                                <button
                                  onClick={() => openEdit(product)}
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
                    <Card key={product.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between" onClick={() => openEdit(product)}>
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
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 line-clamp-1">{product.name}</p>
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
          <Card data-tour="inventory-value-widget" className="p-6 bg-gradient-to-br from-blue-700 to-sky-500 text-white overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">{t('products.totalInventoryValue')}</p>
              <p className="text-3xl font-black mt-1">{formatINR(totalInventoryValue)}</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] bg-white/20 w-fit px-2 py-1 rounded-full font-bold">
                <TrendingUp size={12} />
                {activeProducts.length} products
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
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
        title={editId ? 'Edit Product' : t('products.addProduct')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setIsFormOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={isCreating || isUpdating}
              disabled={!form.name.trim() || !form.categoryId}
            >
              {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Product Image Upload */}
          <div>
            <ImageUpload
              label="Product Image"
              value={form.imageURL}
              onChange={url => setForm(prev => ({ ...prev, imageURL: url }))}
              previewSize="md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name *
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
                  Category *
                  <FieldInfo textKey="tip.product.category" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineCategory(v => !v)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  {showInlineCategory ? <X size={11} /> : <Plus size={11} />}
                  {showInlineCategory ? 'Close' : 'New'}
                </button>
              </div>
              <Select
                options={categoryOptions}
                placeholder="Select category"
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
                  Supplier
                  <FieldInfo textKey="tip.product.supplier" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineSupplier(v => !v)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  {showInlineSupplier ? <X size={11} /> : <Plus size={11} />}
                  {showInlineSupplier ? 'Close' : 'New'}
                </button>
              </div>
              <Select
                options={[
                  { value: '', label: 'None' },
                  ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
                ]}
                placeholder="Select supplier"
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
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Barcode *
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
                  Auto-Generate
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              The barcode type controls how label printers render it — Code 128 suits most retail stickers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cost Price (₹)
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
                  Selling Price (₹) *
                  <FieldInfo textKey="tip.product.sellingPrice" />
                </label>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, priceIncludesGst: false }))}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${!form.priceIncludesGst ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}
                  >
                    Excl. GST
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, priceIncludesGst: true }))}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${form.priceIncludesGst ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}
                  >
                    Incl. GST
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
              GST Rate
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
                Current Stock
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
                Low Stock Threshold
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
              Unit
              <FieldInfo textKey="tip.product.unit" />
            </label>
            <Select
              options={UNIT_OPTIONS}
              value={form.unit}
              onChange={e => setForm(prev => ({ ...prev, unit: e.target.value as UnitType }))}
            />
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
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Live Sticker Preview (50mm × 30mm)</span>
              <div className="w-[260px] p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md text-center flex flex-col items-center justify-between min-h-[140px]">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate w-full">{settings?.businessName || 'SEZNIK RETAIL'}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 my-0.5 truncate w-full">{labelProduct.name}</p>
                
                <canvas ref={canvasRef} className="my-1 max-w-full h-auto" />

                <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">{formatINR(labelProduct.sellingPrice)}</p>
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
