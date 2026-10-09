import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatINR } from '@/utils/currency'
import type { Product } from '@/types/product.types'

export const KOT_MODIFIER_PRESETS = ['Extra Spicy', 'Less Spicy', 'No Onion/Garlic', 'Pack Separately', 'Extra Butter']

interface ItemNotesDialogProps {
  isOpen: boolean
  product: Product | null
  notes: string
  modifiers: string[]
  addOnProducts: Product[]
  selectedAddOnIds: string[]
  onNotesChange: (value: string) => void
  onToggleModifier: (mod: string) => void
  onToggleAddOn: (productId: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export const ItemNotesDialog = ({
  isOpen,
  product,
  notes,
  modifiers,
  addOnProducts,
  selectedAddOnIds,
  onNotesChange,
  onToggleModifier,
  onToggleAddOn,
  onCancel,
  onConfirm,
}: ItemNotesDialogProps) => {
  if (!product) return null

  const addOnExtra = addOnProducts
    .filter((p) => selectedAddOnIds.includes(p.id))
    .reduce((s, p) => s + p.sellingPrice, 0)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={product.name}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            Add to order
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Base {formatINR(product.sellingPrice)}
          {addOnExtra > 0 ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold"> + add-ons {formatINR(addOnExtra)}</span>
          ) : null}
        </p>

        {addOnProducts.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Add-ons (billed)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {addOnProducts.map((addOn) => {
                const selected = selectedAddOnIds.includes(addOn.id)
                return (
                  <button
                    key={addOn.id}
                    type="button"
                    onClick={() => onToggleAddOn(addOn.id)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-900/40 dark:border-emerald-400 dark:text-emerald-100'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {addOn.name} · {formatINR(addOn.sellingPrice)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Kitchen instructions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {KOT_MODIFIER_PRESETS.map((mod) => {
              const selected = modifiers.includes(mod)
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => onToggleModifier(mod)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                    selected
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:border-amber-500 dark:text-amber-100'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {mod}
                </button>
              )
            })}
          </div>
        </div>
        <Input
          placeholder="Other note (e.g. Less oil, extra gravy)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>
    </Modal>
  )
}
