import { Coffee, UtensilsCrossed, ShoppingBag, Cookie, Bike, Wine } from 'lucide-react'
import type { KotVenueType } from '@/types/settings.types'
import { VENUE_PRESETS, VENUE_TYPES } from '../kotConfig'

const VENUE_ICONS = {
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  qsr: ShoppingBag,
  bakery: Cookie,
  cloud_kitchen: Bike,
  bar: Wine,
} as const

interface VenueTypePickerProps {
  value: KotVenueType
  onChange: (venue: KotVenueType) => void
}

export const VenueTypePicker = ({ value, onChange }: VenueTypePickerProps) => {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Store type</p>
      <p className="text-[11px] text-gray-400 mb-2.5">KOT floor and billing follow this. You can still tweak the options below.</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {VENUE_TYPES.map((id) => {
          const preset = VENUE_PRESETS[id]
          const Icon = VENUE_ICONS[id]
          const active = value === id
          return (
            <button
              key={id}
              type="button"
              title={preset.hint}
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[11px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[#0a0a2e] text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const venueIcon = (type: KotVenueType) => VENUE_ICONS[type]
