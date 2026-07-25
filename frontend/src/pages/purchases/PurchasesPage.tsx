import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Spinner } from '@/components/ui/Spinner'
import { DateRangePicker } from '@/components/forms/DateRangePicker'
import { usePurchases, useCreatePurchase, useDeletePurchase } from '@/hooks/usePurchases'
import { useProducts } from '@/hooks/useProducts'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Plus, PlusCircle, Trash2, Truck, Filter } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import toast from 'react-hot-toast'
import type { PurchaseItem } from '@/types/purchase.types'
import type { Purchase } from '@/types/purchase.types'


interface PurchaseItemRow {
  productId: string
  productName: string
  quantity: number
  costPrice: number
}

export const PurchasesPage = () => {
  const pageTutorial = usePageTutorial('purchases')
  const { data: purchases, isLoading } = usePurchases()
  const { data: products } = useProducts()
  const { data: suppliers } = useSuppliers()
  const { mutate: createPurchase, isPending } = useCreatePurchase()
  const { mutate: deletePurchase } = useDeletePurchase()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState<PurchaseItemRow[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantityInput, setQuantityInput] = useState('1')

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const supplierOptions = [
    { value: '', label: 'All Suppliers' },
    ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
  ]

  const formSupplierOptions = [
    { value: '', label: 'Select Supplier' },
    ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
  ]

  const productOptions = [
    { value: '', label: 'Select Product' },
    ...(products ?? [])
      .filter(p => p.isActive)
      .map(p => ({ value: p.id, label: `${p.name} (${p.sku})` })),
  ]

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    let result = purchases ?? []

    if (filterSupplier) {
      result = result.filter(p => p.supplierId === filterSupplier)
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(p => {
        const pDate = p.purchaseDate instanceof Date ? p.purchaseDate : (p.purchaseDate as { toDate: () => Date }).toDate()
        return pDate >= start
      })
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(p => {
        const pDate = p.purchaseDate instanceof Date ? p.purchaseDate : (p.purchaseDate as { toDate: () => Date }).toDate()
        return pDate <= end
      })
    }

    return result
  }, [purchases, filterSupplier, filterStartDate, filterEndDate])

  const totalAmount = items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0)

  const columns: ColumnDef<Purchase>[] = [
    {
      key: 'supplierId',
      header: 'Supplier',
      render: (row) => {
        const supplier = suppliers?.find(s => s.id === row.supplierId)
        return (
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-gray-400" />
            <span className="font-medium">{supplier?.name ?? 'Unknown'}</span>
          </div>
        )
      },
    },
    {
      key: 'purchaseDate',
      header: 'Date',
      render: (row) => {
        const d = row.purchaseDate instanceof Date ? row.purchaseDate : (row.purchaseDate as { toDate: () => Date }).toDate()
        return (
          <span>
            {d.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
          </span>
        )
      },
      sortable: true,
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-sm text-gray-500">{row.items?.length ?? 0} item(s)</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatINR(row.totalAmount)}</span>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(row.id)}
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      ),
    },
  ]

  const handleAddItem = () => {
    if (!selectedProduct) return
    const product = products?.find(p => p.id === selectedProduct)
    if (!product) return

    const qty = parseInt(quantityInput) || 1
    if (qty <= 0) return

    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        costPrice: product.costPrice,
      }]
    })
    setSelectedProduct('')
    setQuantityInput('1')
  }

  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const handleUpdateItemQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId)
    } else {
      setItems(prev => prev.map(i =>
        i.productId === productId ? { ...i, quantity } : i
      ))
    }
  }

  const handleSave = () => {
    if (!supplierId || items.length === 0) {
      toast.error('Please select a supplier and add items')
      return
    }

    createPurchase(
      {
        supplierId,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          costPrice: item.costPrice,
          total: item.costPrice * item.quantity,
        })),
        totalAmount,
        purchaseDate: new Date(),
      },
      {
        onSuccess: () => {
          toast.success('Purchase recorded & stock updated')
          setIsFormOpen(false)
          setItems([])
          setSupplierId('')
        },
        onError: () => toast.error('Failed to record purchase'),
      }
    )
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this purchase? Stock will NOT be reverted.')) return
    deletePurchase(id, {
      onSuccess: () => toast.success('Purchase deleted'),
      onError: () => toast.error('Failed to delete purchase'),
    })
  }

  const clearFilters = () => {
    setFilterSupplier('')
    setFilterStartDate('')
    setFilterEndDate('')
  }

  const hasActiveFilters = filterSupplier || filterStartDate || filterEndDate

  return (
    <div>
      <div data-tour="purchases-header">
        <PageHeader
          title="Purchases"
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <Button leftIcon={<Plus size={16} />} onClick={() => setIsFormOpen(true)}>
              Record Purchase
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Supplier"
              options={supplierOptions}
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
            />
            <DateRangePicker
              startDate={filterStartDate}
              endDate={filterEndDate}
              onStartDateChange={setFilterStartDate}
              onEndDateChange={setFilterEndDate}
            />
          </div>
        )}
      </Card>

      <Card data-tour="purchases-table" className="p-4">
        <DataTable
          data={filteredPurchases}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          emptyMessage="No purchases recorded yet"
        />
      </Card>

      {/* Purchase Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setItems([]); setSupplierId('') }}
        title="Record Purchase"
        size="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <div>
              <span className="text-sm text-gray-500">Total</span>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatINR(totalAmount)}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setIsFormOpen(false); setItems([]); setSupplierId('') }}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={isPending} disabled={!supplierId || items.length === 0}>
                Record Purchase
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Supplier *"
            options={formSupplierOptions}
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
          />

          {/* Add Items Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Products
            </label>
            <div className="flex gap-2 mb-3">
              <Select
                options={productOptions}
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                placeholder="Select product"
                className="flex-1"
              />
              <Input
                type="number"
                min="1"
                value={quantityInput}
                onChange={e => setQuantityInput(e.target.value)}
                placeholder="Qty"
                className="w-24"
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
              />
              <Button onClick={handleAddItem} disabled={!selectedProduct} className="flex-shrink-0">
                <PlusCircle size={16} className="mr-1" />
                Add
              </Button>
            </div>

            {/* Items List */}
            {items.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map(item => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400">{formatINR(item.costPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Qty:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => handleUpdateItemQty(item.productId, parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="text-sm font-semibold w-24 text-right">
                      {formatINR(item.costPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Add products to this purchase</p>
            )}
          </div>
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
        pageKey="purchases"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
