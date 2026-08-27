import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useLocations } from '@/hooks/useLocations'

const STORAGE_KEY = 'pos_selected_location_id'

/**
 * Billing location toggle — only renders when multi-location inventory is
 * enabled in Settings and at least one location exists. Shared between
 * POSPage and POSLitePage/"Scan to Bill" via the same localStorage key, so
 * picking a location on one screen carries over to the other (a cashier is
 * physically at one location for a whole shift, not per cart-line).
 */
export function LocationSelector({ onChange }: { onChange: (locationId: string | null) => void }) {
  const { data: settings } = useSettings()
  const { data: locations = [] } = useLocations()
  const enabled = settings?.locationConfig?.enabled ?? false
  const activeLocations = locations.filter(l => l.isActive)

  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  // Keep the parent in sync, including on first mount and whenever the
  // active-location list changes (e.g. the previously selected one got
  // deactivated — fall back to null rather than silently billing from a
  // location that no longer exists).
  useEffect(() => {
    const stillValid = selected && activeLocations.some(l => l.id === selected)
    const next = stillValid ? selected : null
    if (next !== selected) setSelected(next)
    onChange(enabled ? next : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selected, activeLocations.map(l => l.id).join(',')])

  if (!enabled || activeLocations.length === 0) return null

  const pick = (id: string | null) => {
    setSelected(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Store size={14} className="text-gray-400 shrink-0" />
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => pick(null)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
            selected === null
              ? 'bg-[#0a0a2e] text-white border-[#0a0a2e] shadow-xs'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'
          }`}
        >
          All Stores
        </button>
        {activeLocations.map(loc => {
          const isSelected = selected === loc.id
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => pick(isSelected ? null : loc.id)}
              title={isSelected ? 'Click to unselect' : `Filter by ${loc.name}`}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/30'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              {loc.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
