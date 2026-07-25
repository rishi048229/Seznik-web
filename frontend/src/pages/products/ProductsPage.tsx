import { useState, useEffect } from 'react'
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
import { Spinner } from '@/components/ui/Spinner'
import { BarcodeStockUpdateModal } from './components/BarcodeStockUpdateModal'
import { useProducts, useCreateProduct, useUpdateProduct, useBarcodeProductLookup, useBulkDeleteProducts } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { canManipulateStock } from '@/utils/permissions'
import { Plus, Trash2, Search, Barcode, Grid, List, ChevronLeft, ChevronRight, MoreHorizontal, TrendingUp, AlertTriangle, Layers, Package, CheckSquare, Square, Tag, Lock, Sparkles } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { getBlePrinterState, printEscPos, isBluetoothSupported } from '@/utils/blePrinter'
import { generateLabelEscPos, generateLabelTspl, defaultLabelTemplate } from '@/utils/labelPrint'
import { buildCategoryOptions } from '@/utils/categoryTree'
import type { Product } from '@/types/product.types'
import toast from 'react-hot-toast'

type UnitType = 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'

interface ProductFormState {
  name: string
  categoryId: string
  supplierId: string
  barcode: string
  costPrice: string
  sellingPrice: string
  taxRate: string
  priceIncludesGst: boolean
  currentStock: string
  lowStockThreshold: string
  unit: UnitType
  imageURL: string
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
  const { user } = useAuth()
  const { data: products, isLoading } = useProducts()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { data: settings } = useSettings()
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
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [labelProduct, setLabelProduct] = useState<Product | null>(null)

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

  const getSupplierName = (supplierId?: string) =>
    supplierId ? (suppliers?.find(s => s.id === supplierId)?.name ?? '—') : '—'

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
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  // Label printing stopped for this version — shows coming soon modal
  const handlePrintLabel = (product: Product) => {
    setLabelProduct(product)
    setIsLabelModalOpen(true)
  }

  const openEdit = (row: Product) => {
    setForm({
      name: row.name,
      categoryId: row.categoryId,
      supplierId: row.supplierId ?? '',
      barcode: row.barcode ?? '',
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

    const taxRate = parseFloat(form.taxRate) || 0
    const enteredPrice = parseFloat(form.sellingPrice) || 0
    const baseSellingPrice = form.priceIncludesGst && taxRate > 0
      ? enteredPrice / (1 + taxRate / 100)
      : enteredPrice

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      supplierId: form.supplierId || undefined,
      barcode: form.barcode.trim() || undefined,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: baseSellingPrice,
      taxRate,
      currentStock: parseInt(form.currentStock) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      unit: form.unit,
      ...(form.imageURL ? { imageURL: form.imageURL } : {}),
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

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete product "${name}"?`)) return
    if (!user) return
    import('@/services/productService').then(({ softDeleteProduct }) => {
      softDeleteProduct(user!.uid, id)
        .then(() => toast.success('Product deleted'))
        .catch(() => toast.error('Failed to delete product'))
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
          title="Products"
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
              <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
                Add Product
              </Button>
            </div>
          }
        />
      </div>

      {/* Toolbar */}
      <div data-tour="products-search" className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <Grid size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <List size={16} />
              Grid
            </button>
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
            >
              <option value="">Category</option>
              {categoryOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div className="relative">
            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              className="px-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 dark:text-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-gray-500"
            >
              <option value="">Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="pl-10 w-72"
          />
        </div>
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
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Stock Level</th>
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
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginated.map(product => (
                    <Card key={product.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(product)}>
                      <div className="w-full aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 mb-3 overflow-hidden">
                        {product.imageURL ? (
                          <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={32} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{product.name}</p>
                      <div className="flex items-center justify-between mt-3">
                        <Badge variant={
                          product.currentStock <= 0 ? 'danger' :
                          product.currentStock <= product.lowStockThreshold ? 'warning' : 'success'
                        }>
                          {product.currentStock <= 0 ? 'Out of Stock' : `${product.currentStock} left`}
                        </Badge>
                        <span className="text-base font-bold text-blue-600">{formatINR(product.sellingPrice)}</span>
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
          <Card className="p-6 bg-gradient-to-br from-blue-700 to-sky-500 text-white overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Inventory Value</p>
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
              Stock Alerts
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
        title={editId ? 'Edit Product' : 'Add Product'}
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
          <Input
            label="Product Name *"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Basmati Rice 1kg"
            autoFocus
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              options={categoryOptions}
              placeholder="Select category"
              value={form.categoryId}
              onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
            />
            <Select
              label="Supplier"
              options={[
                { value: '', label: 'None' },
                ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
              ]}
              placeholder="Select supplier"
              value={form.supplierId}
              onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
            />
          </div>

          <Input
            label="Barcode"
            value={form.barcode}
            onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
            placeholder="Scan or enter barcode"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cost Price (₹)"
              type="number"
              step="0.01"
              value={form.costPrice}
              onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
              placeholder="0.00"
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Selling Price (₹) *</label>
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

          <Input
            label="GST Rate (%)"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.taxRate}
            onChange={e => setForm(prev => ({ ...prev, taxRate: e.target.value }))}
            placeholder="e.g. 5, 12, 18"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Current Stock"
              type="number"
              value={form.currentStock}
              onChange={e => setForm(prev => ({ ...prev, currentStock: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Low Stock Threshold"
              type="number"
              value={form.lowStockThreshold}
              onChange={e => setForm(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
              placeholder="10"
            />
          </div>

          <Select
            label="Unit"
            options={UNIT_OPTIONS}
            value={form.unit}
            onChange={e => setForm(prev => ({ ...prev, unit: e.target.value as UnitType }))}
          />
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

      {/* Label Feature Disabled Popup Modal */}
      <Modal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        title="Print Label"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setIsLabelModalOpen(false)}>
              Got it
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center text-center py-4 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner ring-4 ring-amber-50 dark:ring-amber-950/40">
            <Lock size={28} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold mb-1">
              <Sparkles size={12} />
              Feature Coming Soon
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Label Feature Disabled
            </h4>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
              This feature will be live soon
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
            Label printing for {labelProduct ? <span className="font-semibold text-gray-700 dark:text-gray-200">{labelProduct.name}</span> : 'products'} is disabled in this version and will be live in an upcoming release.
          </p>
        </div>
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
