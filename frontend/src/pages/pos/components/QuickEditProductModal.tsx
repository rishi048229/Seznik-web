import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { useCategories } from '@/hooks/useCategories'
import { useUpdateProduct } from '@/hooks/useProducts'
import { useLanguage } from '@/contexts/LanguageContext'
import { buildCategoryOptions } from '@/utils/categoryTree'
import { GST_SLAB_OPTIONS, UNIT_OPTIONS, type UnitType } from '@/utils/productOptions'
import type { Product } from '@/types/product.types'
import toast from 'react-hot-toast'

interface QuickEditProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  /** Fired after a successful save so the caller can sync an already-added cart line. */
  onSaved?: (updated: {
    name: string
    sellingPrice: number
    taxRate: number
    priceIncludesGst: boolean
  }) => void
}

interface QuickEditFormState {
  name: string
  categoryId: string
  costPrice: string
  sellingPrice: string
  taxRate: string
  priceIncludesGst: boolean
  currentStock: string
  lowStockThreshold: string
  unit: UnitType
}

const emptyForm: QuickEditFormState = {
  name: '',
  categoryId: '',
  costPrice: '',
  sellingPrice: '',
  taxRate: '0',
  priceIncludesGst: false,
  currentStock: '0',
  lowStockThreshold: '10',
  unit: 'piece',
}

// Lets staff fix a product's name, price, GST or stock on the spot while
// billing in POS ("Scan to Bill"), instead of having to leave the sale and
// go edit it from the Products page. Deliberately lighter than the full
// Products form — no image/barcode/supplier here, since those aren't things
// you'd normally correct mid-sale.
export const QuickEditProductModal = ({ product, isOpen, onClose, onSaved }: QuickEditProductModalProps) => {
  const { t } = useLanguage()
  const { data: categories } = useCategories()
  const { mutate: updateProduct, isPending } = useUpdateProduct()
  const [form, setForm] = useState<QuickEditFormState>(emptyForm)
  const [gstIsCustom, setGstIsCustom] = useState(false)

  useEffect(() => {
    if (isOpen && product) {
      const taxRateStr = String(product.taxRate ?? 0)
      setForm({
        name: product.name,
        categoryId: product.categoryId,
        costPrice: String(product.costPrice ?? 0),
        sellingPrice: String(product.sellingPrice ?? 0),
        taxRate: taxRateStr,
        priceIncludesGst: product.priceIncludesGst ?? false,
        currentStock: String(product.currentStock ?? 0),
        lowStockThreshold: String(product.lowStockThreshold ?? 10),
        unit: product.unit,
      })
      setGstIsCustom(!GST_SLAB_OPTIONS.some(o => o.value === taxRateStr))
    }
  }, [isOpen, product])

  const categoryOptions = buildCategoryOptions(categories)

  const handleSave = () => {
    if (!product) return
    if (!form.name.trim() || !form.categoryId) {
      toast.error('Please fill in product name and category')
      return
    }

    const taxRate = parseFloat(form.taxRate) || 0
    const sellingPrice = parseFloat(form.sellingPrice) || 0
    const name = form.name.trim()

    updateProduct(
      {
        productId: product.id,
        data: {
          name,
          categoryId: form.categoryId,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice,
          taxRate,
          priceIncludesGst: form.priceIncludesGst,
          currentStock: parseInt(form.currentStock) || 0,
          lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
          unit: form.unit,
        },
      },
      {
        onSuccess: () => {
          toast.success('Product updated')
          onSaved?.({ name, sellingPrice, taxRate, priceIncludesGst: form.priceIncludesGst })
          onClose()
        },
        onError: () => toast.error('Failed to update product'),
      }
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products.editProduct')}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={handleSave} loading={isPending} disabled={!form.name.trim() || !form.categoryId}>
            {t('action.update')}
          </Button>
        </div>
      }
    >
      {product && (
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.productName')} *
              <FieldInfo textKey="tip.product.name" />
            </label>
            <Input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('products.category')} *
              <FieldInfo textKey="tip.product.category" />
            </label>
            <Select
              options={categoryOptions}
              placeholder={t('products.selectCategory')}
              value={form.categoryId}
              onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
            />
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
        </div>
      )}
    </Modal>
  )
}
