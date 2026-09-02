import { formatINR } from '@/utils/currency'
import { computeChargeAmount, type BillChargePreset } from '@/constants/restaurantBilling'

interface BillChargeTogglesProps {
  presets: BillChargePreset[]
  selectedIds: string[]
  onToggle: (presetId: string) => void
  netSubtotal: number
  grossSubtotal: number
}

export function BillChargeToggles({
  presets,
  selectedIds,
  onToggle,
  netSubtotal,
  grossSubtotal,
}: BillChargeTogglesProps) {
  if (presets.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = selectedIds.includes(preset.id)
        const preview = computeChargeAmount(preset, netSubtotal, grossSubtotal)
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onToggle(preset.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              selected
                ? 'bg-violet-600 text-white border-violet-600'
                : 'border-gray-300 dark:border-dark-border-strong text-gray-600 dark:text-gray-300'
            }`}
          >
            {preset.label} · {formatINR(preview)}
          </button>
        )
      })}
    </div>
  )
}
