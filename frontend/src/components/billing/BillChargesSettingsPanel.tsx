import { Switch } from '@/components/ui/Switch'
import {
  createPresetId,
  type BillChargePreset,
} from '@/constants/restaurantBilling'

interface BillChargesSettingsPanelProps {
  presets: BillChargePreset[]
  onChange: (presets: BillChargePreset[]) => void
}

export function BillChargesSettingsPanel({ presets, onChange }: BillChargesSettingsPanelProps) {
  const update = (index: number, patch: Partial<BillChargePreset>) => {
    onChange(presets.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bill extra charges</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          Service charge, packing, delivery, or other add-ons. Cashiers can toggle these at checkout. Changing presets does not rewrite old bills.
        </p>
      </div>
      {presets.map((preset, index) => (
        <div key={preset.id} className="rounded-lg border border-gray-200 dark:border-dark-border-strong bg-white dark:bg-dark-card p-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={preset.label}
              onChange={(e) => update(index, { label: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-lg bg-white dark:bg-dark-card dark:text-gray-100 text-sm"
              placeholder="Charge label"
            />
            <button
              type="button"
              onClick={() => onChange(presets.filter((_, i) => i !== index))}
              className="px-3 text-sm font-semibold text-red-600"
            >
              Remove
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update(index, { type: 'percent' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${preset.type === 'percent' ? 'bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 border-blue-600' : 'border-gray-300 dark:border-dark-border-strong text-gray-500'}`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => update(index, { type: 'flat' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${preset.type === 'flat' ? 'bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 border-blue-600' : 'border-gray-300 dark:border-dark-border-strong text-gray-500'}`}
            >
              ₹
            </button>
            <input
              type="number"
              min={0}
              step="0.01"
              value={preset.value}
              onChange={(e) => update(index, { value: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-lg bg-white dark:bg-dark-card dark:text-gray-100 text-sm"
            />
          </div>
          {preset.type === 'percent' ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update(index, { applyOn: 'net_subtotal' })}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${preset.applyOn !== 'gross' ? 'bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 border-blue-600' : 'border-gray-300 dark:border-dark-border-strong text-gray-500'}`}
              >
                On net (after discount)
              </button>
              <button
                type="button"
                onClick={() => update(index, { applyOn: 'gross' })}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${preset.applyOn === 'gross' ? 'bg-blue-600 dark:bg-zinc-100 dark:text-zinc-900 border-blue-600' : 'border-gray-300 dark:border-dark-border-strong text-gray-500'}`}
              >
                On gross (before discount)
              </button>
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Switch
              checked={preset.enabled}
              onChange={(val) => update(index, { enabled: val })}
              label="Show at checkout"
            />
            <Switch
              checked={preset.defaultSelected}
              onChange={(val) => update(index, { defaultSelected: val })}
              label="Default on"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...presets,
            {
              id: createPresetId(),
              label: 'New Charge',
              kind: 'other',
              type: 'percent',
              value: 5,
              enabled: true,
              defaultSelected: false,
              applyOn: 'net_subtotal',
            },
          ])
        }
        className="w-full py-2 rounded-lg border border-dashed border-blue-400 text-sm font-bold text-blue-600"
      >
        + Add Charge Preset
      </button>
    </div>
  )
}
