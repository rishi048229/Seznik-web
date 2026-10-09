import { useMemo, useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatINR } from '@/utils/currency'
import type { Product } from '@/types/product.types'

interface KotAddOnSettingsTabProps {
  productIds: string[]
  products: Product[]
  onChange: (ids: string[]) => void
}

export const KotAddOnSettingsTab = ({ productIds, products, onChange }: KotAddOnSettingsTabProps) => {
  const [q, setQ] = useState('')
  const selected = useMemo(
    () => productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [productIds, products]
  )
  const pool = useMemo(() => {
    const query = q.trim().toLowerCase()
    return products
      .filter((p) => p.isActive && !productIds.includes(p.id))
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .slice(0, 40)
  }, [products, productIds, q])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Billable add-ons</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Pick products that can be attached to a dish (extra cheese, toppings, etc.). Prices come from the product
          selling price and appear on KOT, guest bill, and receipt.
        </p>
      </div>

      {selected.length > 0 ? (
        <ul className="space-y-2">
          {selected.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                <p className="text-xs text-gray-500">{formatINR(p.sellingPrice)}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(productIds.filter((id) => id !== p.id))}
                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                aria-label={`Remove ${p.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-6 text-center">
          No add-ons yet. Search products below and tap Add.
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Search products to add as add-ons..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin">
        {pool.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange([...productIds, p.id])}
            className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 shrink-0">
              <Plus size={14} />
              {formatINR(p.sellingPrice)}
            </span>
          </button>
        ))}
        {pool.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No matching products.</p>
        )}
      </div>
    </div>
  )
}
