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
  onNotesChange: (value: string) => void
  onToggleModifier: (mod: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export const ItemNotesDialog = ({
  isOpen,
  product,
  notes,
  modifiers,
  onNotesChange,
  onToggleModifier,
  onCancel,
  onConfirm,
}: ItemNotesDialogProps) => {
  if (!product) return null

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
            Add to KOT
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatINR(product.sellingPrice)}</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Cooking instructions
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
