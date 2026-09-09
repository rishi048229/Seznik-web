import { useMemo, useRef, useState, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatINR } from '@/utils/currency'
import { getTopLevelCategories } from '@/utils/categoryTree'
import { isProductAvailable } from '@/utils/businessFeatures'
import type { Product } from '@/types/product.types'
import type { Category } from '@/services/categoryService'

interface MenuPickerProps {
  products: Product[]
  categories: Category[]
  search: string
  onSearchChange: (value: string) => void
  categoryId: string
  onCategoryChange: (id: string) => void
  onPick: (product: Product) => void
  onToggleAvailability?: (product: Product, nextActive: boolean) => void
  showUnavailable?: boolean
  onShowUnavailableChange?: (value: boolean) => void
  onAddFoodItem?: () => void
}

const dietaryFromDescription = (description?: string | null): 'veg' | 'non_veg' | 'egg' | null => {
  if (!description) return null
  const d = description.toLowerCase()
  if (d.startsWith('veg') || d.includes('· veg ·') || /^veg\b/.test(d)) return 'veg'
  if (d.startsWith('egg') || d.includes('· egg ·')) return 'egg'
  if (d.startsWith('non-veg') || d.includes('non-veg')) return 'non_veg'
  return null
}

const COLS_SM = 2
const COLS_MD = 3
const ROW_ESTIMATE = 178

const MenuCard = memo(function MenuCard({
  product,
  unavailable,
  onPick,
  onToggleAvailability,
}: {
  product: Product
  unavailable: boolean
  onPick: (product: Product) => void
  onToggleAvailability?: (product: Product, nextActive: boolean) => void
}) {
  const dietary = dietaryFromDescription(product.description)
  return (
    <div
      className={`text-left rounded-xl border bg-white dark:bg-dark-card p-2.5 transition-all duration-150 [content-visibility:auto] [contain-intrinsic-size:0_160px] flex flex-col justify-between group ${
        unavailable
          ? 'border-red-300 dark:border-red-800/60 bg-red-50/10 dark:bg-red-950/10 opacity-80'
          : 'border-gray-200 dark:border-dark-border hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (!unavailable) onPick(product)
        }}
        disabled={unavailable}
        className="w-full text-left disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
      >
        <div className="aspect-[4/3] rounded-lg bg-gray-100 dark:bg-dark-elevated overflow-hidden mb-2 relative">
          {product.imageURL ? (
            <img
              src={product.imageURL}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-300 dark:text-gray-500">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          {unavailable && (
            <span className="absolute top-1.5 right-1.5 rounded-md bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
              Out of Stock
            </span>
          )}
          {dietary && !unavailable && (
            <span
              className={`absolute top-1.5 left-1.5 rounded-md text-[9px] font-bold px-1.5 py-0.5 border ${
                dietary === 'veg'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-400'
                  : dietary === 'egg'
                    ? 'bg-amber-50 text-amber-800 border-amber-400'
                    : 'bg-red-50 text-red-700 border-red-400'
              }`}
            >
              {dietary === 'veg' ? 'VEG' : dietary === 'egg' ? 'EGG' : 'N/V'}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{product.name}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {formatINR(product.sellingPrice)}
          </span>
          {!unavailable && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white transition-colors">
              <Plus size={13} /> Add
            </span>
          )}
        </div>
      </button>

      {onToggleAvailability && (
        <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-dark-border/60">
          {unavailable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleAvailability(product, true)
              }}
              className="w-full text-[11px] font-bold py-1.5 px-2 rounded-lg border border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              Mark Available
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleAvailability(product, false)
              }}
              className="w-full text-[10px] font-medium py-1 px-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors text-center cursor-pointer"
            >
              Mark Out of Stock (86)
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export const MenuPicker = ({
  products,
  categories,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  onPick,
  onToggleAvailability,
  showUnavailable = false,
  onShowUnavailableChange,
  onAddFoodItem,
}: MenuPickerProps) => {
  const topCats = useMemo(() => getTopLevelCategories(categories), [categories])
  const parentRef = useRef<HTMLDivElement>(null)
  const [localShowUnavailable, setLocalShowUnavailable] = useState(false)
  const unavailableMode = onShowUnavailableChange ? showUnavailable : localShowUnavailable
  const setUnavailableMode = onShowUnavailableChange ?? setLocalShowUnavailable

  const cols =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
      ? COLS_MD
      : COLS_SM

  const rowCount = Math.ceil(products.length / cols) || 0

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 3,
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-3 sm:p-4 space-y-3 border-b border-gray-200 dark:border-dark-border">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search menu..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          {onAddFoodItem && (
            <button
              type="button"
              onClick={onAddFoodItem}
              className="shrink-0 inline-flex items-center gap-1 h-10 px-3 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Plus size={14} />
              Add Item
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              setUnavailableMode(false)
              onCategoryChange('')
            }}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              !unavailableMode && categoryId === ''
                ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 border-[#0a0a2e] dark:border-zinc-500'
                : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-border'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setUnavailableMode(true)
              onCategoryChange('')
            }}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              unavailableMode
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-border hover:border-gray-300'
            }`}
          >
            Out of Stock
          </button>
          {topCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setUnavailableMode(false)
                onCategoryChange(cat.id)
              }}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                !unavailableMode && categoryId === cat.id
                  ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 border-[#0a0a2e] dark:border-zinc-500'
                  : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-border'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin">
        {products.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unavailableMode
                ? 'No out of stock items.'
                : 'No menu items match this search.'}
            </p>
            {onAddFoodItem && !unavailableMode && (
              <button
                type="button"
                onClick={onAddFoodItem}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                <Plus size={14} />
                Add a food item
              </button>
            )}
          </div>
        ) : (
          <div
            style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * cols
              const rowItems = products.slice(start, start + cols)
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pb-2.5"
                >
                  {rowItems.map((product) => (
                    <MenuCard
                      key={product.id}
                      product={product}
                      unavailable={!isProductAvailable(product)}
                      onPick={onPick}
                      onToggleAvailability={onToggleAvailability}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
