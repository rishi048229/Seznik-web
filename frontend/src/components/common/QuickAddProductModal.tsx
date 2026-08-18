import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { useCreateProduct } from '@/hooks/useProducts'
import { useCategories, useCreateCategory } from '@/hooks/useCategories'
import { useSuppliers } from '@/hooks/useSuppliers'
import { buildCategoryOptions } from '@/utils/categoryTree'
import { GST_SLAB_OPTIONS, UNIT_OPTIONS, type UnitType } from '@/utils/productOptions'
import { Plus, Wand2, Sparkles, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'

type BarcodeType = 'CODE128' | 'EAN13' | 'QR'

interface QuickAddProductModalProps {
  isOpen: boolean
  onClose: () => void
  defaultSupplierId?: string
  onProductCreated?: (product: { id: string; name: string; costPrice: number; sellingPrice: number }) => void
}

const generateBarcodeValue = (type: BarcodeType = 'CODE128'): string => {
  if (type === 'EAN13') {
    let digits = ''
    for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10)
    const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
    const check = (10 - (sum % 10)) % 10
    return digits + check
  }
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `SZ${Date.now().toString().slice(-8)}${rand}`
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  isOpen,
  onClose,
  defaultSupplierId = '',
  onProductCreated,
}) => {
  const { t } = useLanguage()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { mutate: createProduct, isPending: isCreatingProduct } = useCreateProduct()
  const { mutate: createCategory, isPending: isCreatingCategory } = useCreateCategory()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState(defaultSupplierId)
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [barcode, setBarcode] = useState('')
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128')
  const [taxRate, setTaxRate] = useState('0')
  const [priceIncludesGst, setPriceIncludesGst] = useState(false)
  const [unit, setUnit] = useState<UnitType>('piece')
  const [currentStock, setCurrentStock] = useState('0')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')

  // Inline category creation
  const [showInlineCategory, setShowInlineCategory] = useState(false)
  const [inlineCategoryName, setInlineCategoryName] = useState('')

  // When opened, initialize default values and barcode
  useEffect(() => {
    if (isOpen) {
      setName('')
      setCostPrice('')
      setSellingPrice('')
      setSupplierId(defaultSupplierId || '')
      setTaxRate('0')
      setPriceIncludesGst(false)
      setUnit('piece')
      setCurrentStock('0')
      setLowStockThreshold('10')
      setBarcode(generateBarcodeValue('CODE128'))
      setShowInlineCategory(false)
      setInlineCategoryName('')

      // Default category if available
      if (categories && categories.length > 0) {
        setCategoryId(categories[0].id)
      } else {
        setCategoryId('')
      }
    }
  }, [isOpen, defaultSupplierId, categories])

  const categoryOptions = [
    { value: '', label: t('products.selectCategory') || 'Select Category' },
    ...buildCategoryOptions(categories ?? []),
  ]

  const supplierOptions = [
    { value: '', label: t('purchases.selectSupplier') || 'None / No Supplier' },
    ...(suppliers ?? []).map(s => ({ value: s.id, label: s.name })),
  ]

  const handleAutoGenerateBarcode = () => {
    const code = generateBarcodeValue(barcodeType)
    setBarcode(code)
    toast.success(`Generated Barcode: ${code}`)
  }

  const handleInlineCreateCategory = () => {
    if (!inlineCategoryName.trim()) return
    createCategory(
      { name: inlineCategoryName.trim() },
      {
        onSuccess: (newCatId) => {
          toast.success('Category created')
          setCategoryId(newCatId)
          setInlineCategoryName('')
          setShowInlineCategory(false)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create category')
        },
      }
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter a product name')
      return
    }

    const parsedCost = parseFloat(costPrice)
    if (isNaN(parsedCost) || parsedCost < 0) {
      toast.error('Please enter a valid cost price')
      return
    }

    const parsedSelling = parseFloat(sellingPrice)
    if (isNaN(parsedSelling) || parsedSelling < 0) {
      toast.error('Please enter a valid selling price')
      return
    }

    let finalCategoryId = categoryId
    if (!finalCategoryId && categories && categories.length > 0) {
      finalCategoryId = categories[0].id
    }

    const finalBarcode = barcode.trim() || generateBarcodeValue(barcodeType)

    const payload = {
      name: name.trim(),
      categoryId: finalCategoryId,
      supplierId: supplierId || undefined,
      costPrice: parsedCost,
      sellingPrice: parsedSelling,
      barcode: finalBarcode,
      barcodeType,
      taxRate: parseFloat(taxRate) || 0,
      priceIncludesGst,
      unit,
      currentStock: parseInt(currentStock) || 0,
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      imageURL: '',
      isActive: true,
    }

    createProduct(payload, {
      onSuccess: (createdProductOrId: any) => {
        toast.success(`Product "${name.trim()}" created successfully!`)
        const newId = typeof createdProductOrId === 'string' ? createdProductOrId : createdProductOrId?.id
        if (onProductCreated && newId) {
          onProductCreated({
            id: newId,
            name: name.trim(),
            costPrice: parsedCost,
            sellingPrice: parsedSelling,
          })
        }
        onClose()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to create product')
      },
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Product to Inventory"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span>This product will be saved directly into your <strong>Products</strong> catalog and selected in this purchase.</span>
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Product Name *
            <FieldInfo textKey="tip.product.name" />
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Basmati Rice 5kg, Amul Butter 500g"
            required
            autoFocus
          />
        </div>

        {/* Category & Supplier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Category
              </label>
              {!showInlineCategory && (
                <button
                  type="button"
                  onClick={() => setShowInlineCategory(true)}
                  className="text-[11px] text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5"
                >
                  <Plus size={12} /> New
                </button>
              )}
            </div>
            {showInlineCategory ? (
              <div className="flex gap-1.5 items-center">
                <Input
                  value={inlineCategoryName}
                  onChange={e => setInlineCategoryName(e.target.value)}
                  placeholder="New category name"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleInlineCreateCategory}
                  loading={isCreatingCategory}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowInlineCategory(false)}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <Select
                options={categoryOptions}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Supplier (Optional)
            </label>
            <Select
              options={supplierOptions}
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
            />
          </div>
        </div>

        {/* Cost Price & Selling Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Purchase / Cost Price (₹) *
              <FieldInfo textKey="tip.product.costPrice" />
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Selling Price / MRP (₹) *
              <FieldInfo textKey="tip.product.sellingPrice" />
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={sellingPrice}
              onChange={e => setSellingPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        {/* Barcode & Auto-Generate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Barcode / SKU Number
            </label>
            <div className="flex gap-2">
              <Input
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="Scan or type barcode"
                className="flex-1 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoGenerateBarcode}
                className="flex-shrink-0 text-purple-600 border-purple-200 hover:bg-purple-50"
                leftIcon={<Wand2 size={13} />}
              >
                Auto-Generate
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Unit
            </label>
            <Select
              options={UNIT_OPTIONS.map(u => ({ value: u.value, label: u.label }))}
              value={unit}
              onChange={e => setUnit(e.target.value as UnitType)}
            />
          </div>
        </div>

        {/* GST Tax Rate & Pricing Structure */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              GST Tax Rate
            </label>
            <Select
              options={GST_SLAB_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
              value={taxRate}
              onChange={e => setTaxRate(e.target.value)}
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={priceIncludesGst}
                onChange={e => setPriceIncludesGst(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Selling Price already includes GST</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isCreatingProduct}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
            leftIcon={<Plus size={16} />}
          >
            Create Product & Add to Purchase
          </Button>
        </div>
      </form>
    </Modal>
  )
}
