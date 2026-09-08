import { useState } from 'react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { Utensils, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateProduct } from '@/hooks/useProducts'
import { useCategories } from '@/hooks/useCategories'
import type { Product } from '@/types/product.types'

interface AddFoodItemModalProps {
  isOpen: boolean
  onClose: () => void
  onItemCreated?: (productId: string) => void
}

type FoodDietaryType = 'veg' | 'non_veg' | 'egg'

const FOOD_CATEGORIES = [
  'Fast Food & Snacks',
  'Beverages & Chai',
  'Main Course',
  'Starters & Tandoor',
  'Breads & Rice',
  'Desserts & Sweets',
  'Bakery & Cakes',
  'South Indian',
  'Chinese & Momos',
]

const FOOD_UNITS = ['Plate', 'Portion', 'Piece', 'Cup', 'Half', 'Full', 'Bowl', 'Combo']

const KITCHEN_STATIONS = [
  'Main Kitchen',
  'Tandoor & Grill',
  'Beverage Bar & Chai',
  'Bakery & Dessert',
]

export const AddFoodItemModal = ({ isOpen, onClose, onItemCreated }: AddFoodItemModalProps) => {
  const { mutateAsync: createProduct, isPending } = useCreateProduct()
  const { data: categories = [] } = useCategories()

  const [name, setName] = useState('')
  const [dietaryType, setDietaryType] = useState<FoodDietaryType>('veg')
  const [categoryName, setCategoryName] = useState(FOOD_CATEGORIES[0])
  const [unitLabel, setUnitLabel] = useState('Plate')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [taxRate, setTaxRate] = useState('5')
  const [kitchenStation, setKitchenStation] = useState(KITCHEN_STATIONS[0])
  const [preparationTime, setPreparationTime] = useState('10')

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setPrice('')
    setCostPrice('')
    setDietaryType('veg')
    setCategoryName(FOOD_CATEGORIES[0])
    setUnitLabel('Plate')
    setTaxRate('5')
    setKitchenStation(KITCHEN_STATIONS[0])
    setPreparationTime('10')
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    const sellingPrice = parseFloat(price)
    if (!trimmedName) {
      toast.error('Enter the dish / food item name')
      return
    }
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Enter a valid selling price')
      return
    }

    const matchedCat = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
    const categoryId = matchedCat?.id || categories[0]?.id
    if (!categoryId) {
      toast.error('Create a product category first (e.g. Main Course)')
      return
    }

    const dietaryLabel =
      dietaryType === 'veg' ? 'Veg' : dietaryType === 'egg' ? 'Egg' : 'Non-veg'

    try {
      const payload: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'> = {
        name: trimmedName,
        categoryId,
        costPrice: parseFloat(costPrice) || 0,
        sellingPrice,
        taxRate: parseFloat(taxRate) || 0,
        priceIncludesGst: true,
        // Prepared on demand — no stock gating in KOT
        currentStock: 0,
        lowStockThreshold: 0,
        unit: 'piece',
        isActive: true,
        isAvailable: true,
        description: `${dietaryLabel} · ${unitLabel} · ${kitchenStation} · Prep ${parseInt(preparationTime, 10) || 10} min`,
      }

      const productId = await createProduct(payload)
      resetForm()
      onClose()
      onItemCreated?.(productId)
      toast.success(`"${trimmedName}" is live on your menu`)
    } catch (err) {
      toastError(err, 'Could not create food item')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Utensils size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Add Food / Menu Item</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Quick setup for kitchens, cafes & food stalls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Dish / Menu Name *</label>
            <Input
              className="mt-1.5 h-10"
              placeholder="e.g. Masala Dosa, Cold Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Dietary</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'veg' as const, label: 'Veg', active: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                  { id: 'non_veg' as const, label: 'Non-veg', active: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
                  { id: 'egg' as const, label: 'Egg', active: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDietaryType(opt.id)}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    dietaryType === opt.id
                      ? opt.active
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Category</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {FOOD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryName(cat)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border ${
                    categoryName === cat
                      ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Serving unit</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {FOOD_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitLabel(u)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border ${
                    unitLabel === u
                      ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Selling price *</label>
              <Input
                className="mt-1.5 h-10"
                inputMode="decimal"
                placeholder="120"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cost (optional)</label>
              <Input
                className="mt-1.5 h-10"
                inputMode="decimal"
                placeholder="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">GST %</label>
              <Input
                className="mt-1.5 h-10"
                inputMode="decimal"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Prep minutes</label>
              <Input
                className="mt-1.5 h-10"
                inputMode="numeric"
                value={preparationTime}
                onChange={(e) => setPreparationTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kitchen station</p>
            <div className="grid grid-cols-2 gap-1.5">
              {KITCHEN_STATIONS.map((station) => (
                <button
                  key={station}
                  type="button"
                  onClick={() => setKitchenStation(station)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-semibold border text-left ${
                    kitchenStation === station
                      ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {station}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1 bg-[#0a0a2e] hover:bg-[#1a1555]" loading={isPending} onClick={() => void handleCreate()}>
            Add to menu
          </Button>
        </div>
      </div>
    </div>
  )
}
