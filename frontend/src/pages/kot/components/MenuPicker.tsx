import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatINR } from '@/utils/currency'
import { getTopLevelCategories } from '@/utils/categoryTree'
import type { Product } from '@/types/product.types'
import type { Category } from '@/services/categoryService'

interface MenuPickerProps {
  products: Product[]
  categories: Category[]
  search: string
  onSearchChange: (value: string) => void
  categoryId: string
  onCategoryChange: (id: string) => void
  stockFor: (product: Product) => number
  onPick: (product: Product) => void
}

export const MenuPicker = ({
  products,
  categories,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  stockFor,
  onPick,
}: MenuPickerProps) => {
  const topCats = getTopLevelCategories(categories)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-3 sm:p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Search menu..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              categoryId === ''
                ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
            }`}
          >
            All
          </button>
          {topCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                categoryId === cat.id
                  ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin">
        {products.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">No menu items match this search.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {products.map((product) => {
              const stock = stockFor(product)
              const out = stock <= 0
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => !out && onPick(product)}
                  disabled={out}
                  className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="aspect-[4/3] rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden mb-2">
                    {product.imageURL ? (
                      <img src={product.imageURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-300 dark:text-gray-500">
                        {product.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{product.name}</p>
                  <div className="flex items-center justify-between mt-1 gap-1">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{formatINR(product.sellingPrice)}</span>
                    <span className={`text-[10px] font-medium ${out ? 'text-red-500' : 'text-gray-400'}`}>
                      {out ? 'Out' : `Stk ${stock}`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
