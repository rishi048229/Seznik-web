import { Bike, LayoutGrid, ShoppingBag, Store, Users, UtensilsCrossed } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { VenueTypePicker } from './VenueTypePicker'
import { ORDER_TYPE_OPTIONS, applyVenuePreset, tableNounLabel } from '../kotConfig'
import type { KotConfig, KotRoomType, KotTableNoun, KotVenueType } from '@/types/settings.types'
import type { KOTOrderType } from '@/types/kot.types'

interface KotSettingsFieldsProps {
  value: Required<KotConfig>
  onChange: (next: Required<KotConfig>) => void
}

const chipClass = (active: boolean) =>
  `inline-flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-medium transition-colors duration-150 ${
    active
      ? 'bg-[#0a0a2e] text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
  }`

const ORDER_TYPE_ICONS = {
  dine_in: UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
} as const

const FLOOR_NOUNS: Array<{ id: KotTableNoun; label: string; icon: typeof LayoutGrid }> = [
  { id: 'tables', label: 'Tables', icon: LayoutGrid },
  { id: 'seats', label: 'Seats', icon: Users },
  { id: 'counters', label: 'Counters', icon: Store },
]

export const KotSettingsFields = ({ value, onChange }: KotSettingsFieldsProps) => {
  const setField = <K extends keyof Required<KotConfig>>(key: K, next: Required<KotConfig>[K]) => {
    onChange({ ...value, [key]: next })
  }

  const toggleOrderType = (id: KOTOrderType) => {
    const has = value.allowedOrderTypes.includes(id)
    if (has && value.allowedOrderTypes.length === 1) return
    const next = has ? value.allowedOrderTypes.filter((t) => t !== id) : [...value.allowedOrderTypes, id]
    const defaultOrderType = next.includes(value.defaultOrderType) ? value.defaultOrderType : next[0]
    onChange({ ...value, allowedOrderTypes: next, defaultOrderType })
  }

  const defaultChoices = ORDER_TYPE_OPTIONS.filter((opt) => value.allowedOrderTypes.includes(opt.id))

  return (
    <div className="space-y-4">
      <VenueTypePicker
        value={value.venueType}
        onChange={(venue: KotVenueType) => onChange(applyVenuePreset(value, venue))}
      />

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orders you take</p>
        <p className="text-[11px] text-gray-400 mb-2">Turn off types you never use. At least one stays on.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {ORDER_TYPE_OPTIONS.map((opt) => {
            const active = value.allowedOrderTypes.includes(opt.id)
            const Icon = ORDER_TYPE_ICONS[opt.id]
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleOrderType(opt.id)}
                className={chipClass(active)}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.75} />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default order type</p>
        <div className={`grid gap-1.5 ${defaultChoices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {defaultChoices.map((opt) => {
            const active = value.defaultOrderType === opt.id
            const Icon = ORDER_TYPE_ICONS[opt.id]
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setField('defaultOrderType', opt.id)}
                className={chipClass(active)}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.75} />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor names</p>
        <p className="text-[11px] text-gray-400 mb-2">What staff see on the KOT page.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {FLOOR_NOUNS.map(({ id, label, icon: Icon }) => {
            const active = value.tableNoun === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setField('tableNoun', id)}
                className={chipClass(active)}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.75} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <Switch
          label={`Show ${tableNounLabel(value.tableNoun).toLowerCase()}`}
          description="Floor plan on the KOT page"
          checked={value.showTables}
          onChange={(checked) => setField('showTables', checked)}
        />
        <Switch
          label="Waiter name on tickets"
          checked={value.showWaiterField}
          onChange={(checked) => setField('showWaiterField', checked)}
        />
        <Switch
          label="Print waiter on KOT slip"
          checked={value.showWaiterOnSlip}
          onChange={(checked) => setField('showWaiterOnSlip', checked)}
        />
        <Switch
          label="Service charge on bills"
          checked={value.showServiceCharge}
          onChange={(checked) => setField('showServiceCharge', checked)}
        />
        <Switch
          label="AC / Non-AC room charges"
          checked={value.showRoomCharges}
          onChange={(checked) => setField('showRoomCharges', checked)}
        />
        <Switch
          label="Override item tax with a bill tax %"
          description="When off, each food item keeps its own tax rate."
          checked={value.applyTaxOverride}
          onChange={(checked) => setField('applyTaxOverride', checked)}
        />
      </div>

      <Input
        label="KOT slip title"
        value={value.kotSlipTitle}
        onChange={(e) => setField('kotSlipTitle', e.target.value)}
      />
      <Input
        label="Default tax %"
        type="number"
        min={0}
        step="0.01"
        value={String(value.taxRate)}
        onChange={(e) => setField('taxRate', Number(e.target.value) || 0)}
      />

      {value.showServiceCharge && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Service charge</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {(['percent', 'flat'] as const).map((type) => {
              const active = value.serviceChargeType === type
              return (
                <button key={type} type="button" aria-pressed={active} onClick={() => setField('serviceChargeType', type)} className={chipClass(active)}>
                  {type === 'percent' ? 'Percent of food' : 'Flat amount (₹)'}
                </button>
              )
            })}
          </div>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={String(value.serviceChargeValue)}
            onChange={(e) => setField('serviceChargeValue', Number(e.target.value) || 0)}
            placeholder={value.serviceChargeType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
          />
        </div>
      )}

      {value.showRoomCharges && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="AC room charge (₹)"
              type="number"
              min={0}
              step="0.01"
              value={String(value.acCharge)}
              onChange={(e) => setField('acCharge', Number(e.target.value) || 0)}
            />
            <Input
              label="Non-AC room charge (₹)"
              type="number"
              min={0}
              step="0.01"
              value={String(value.nonAcCharge)}
              onChange={(e) => setField('nonAcCharge', Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default room type</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'none' as KotRoomType, label: 'None' },
                  { id: 'ac' as KotRoomType, label: 'AC' },
                  { id: 'non_ac' as KotRoomType, label: 'Non-AC' },
                ]
              ).map((opt) => {
                const active = value.defaultRoomType === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setField('defaultRoomType', opt.id)}
                    className={chipClass(active)}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
