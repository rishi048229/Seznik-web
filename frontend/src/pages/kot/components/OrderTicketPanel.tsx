import { Check, Clock, Flame, Minus, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatINR } from '@/utils/currency'
import { formatSentTime } from '../kotUtils'
import { visibleOrderTypes } from '../kotConfig'
import type { KOTDeltaChange, KOTDraftItem, KOTOrderItem, KOTOrderType } from '@/types/kot.types'
import type { KotConfig } from '@/types/settings.types'

interface OrderTicketPanelProps {
  tableName: string
  orderNumber?: number
  orderType: KOTOrderType
  onOrderTypeChange: (type: KOTOrderType) => void
  waiterName: string
  onWaiterChange: (value: string) => void
  showWaiter?: boolean
  waiterNames?: string[]
  onAddWaiter?: () => void
  allowedOrderTypes?: KotConfig['allowedOrderTypes']
  sentItems: KOTOrderItem[]
  unprintedServerItems: KOTOrderItem[]
  pendingItems: KOTDraftItem[]
  onPendingQty: (tempId: string, qty: number) => void
  onRemovePending: (tempId: string) => void
  /** Local draft qty overrides for existing (fired) items */
  itemQuantities?: Record<string, number>
  itemNotesDraft?: Record<string, string>
  voidedItems?: Record<string, string>
  onExistingQty?: (itemId: string, qty: number) => void
  onExistingNotes?: (itemId: string, notes: string) => void
  onRequestVoid?: (itemId: string) => void
  onUndoVoid?: (itemId: string) => void
  deltaChanges?: KOTDeltaChange[]
  onFireDelta?: () => void
  firingDelta?: boolean
  subtotal: number
  tax: number
  grandTotal: number
}

export const OrderTicketPanel = ({
  tableName,
  orderNumber,
  orderType,
  onOrderTypeChange,
  waiterName,
  onWaiterChange,
  showWaiter = true,
  waiterNames = [],
  onAddWaiter,
  allowedOrderTypes,
  sentItems,
  unprintedServerItems,
  pendingItems,
  onPendingQty,
  onRemovePending,
  itemQuantities = {},
  itemNotesDraft = {},
  voidedItems = {},
  onExistingQty,
  onExistingNotes,
  onRequestVoid,
  onUndoVoid,
  deltaChanges = [],
  onFireDelta,
  firingDelta = false,
  subtotal,
  tax,
  grandTotal,
}: OrderTicketPanelProps) => {
  const newCount = unprintedServerItems.length + pendingItems.length
  const typeOptions = visibleOrderTypes({ allowedOrderTypes })
  const canEditExisting = !!onExistingQty

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200 dark:border-dark-border space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{tableName}</h2>
          {orderNumber != null && (
            <span className="text-sm font-semibold text-blue-600 dark:text-white">#KOT-{orderNumber}</span>
          )}
        </div>
        <div className={`grid gap-1 ${typeOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {typeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onOrderTypeChange(opt.id)}
              className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors duration-150 ${
                orderType === opt.id
                  ? 'bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-elevated'
              }`}
              aria-pressed={orderType === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {showWaiter && (
          <div className="space-y-1.5">
            {waiterNames.length > 0 && (
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {waiterNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onWaiterChange(name)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      waiterName === name
                        ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Waiter / server name"
                  value={waiterName}
                  onChange={(e) => onWaiterChange(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={onAddWaiter}
                disabled={!waiterName.trim()}
                className="shrink-0 h-9 px-2.5 rounded-lg text-[11px] font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Add Waiter
              </button>
            </div>
          </div>
        )}
      </div>

      {deltaChanges.length > 0 && onFireDelta && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
                Unfired Changes ({deltaChanges.length})
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300">Ready to fire delta</p>
            </div>
            <Flame size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deltaChanges.map((c, idx) => (
              <span
                key={`${c.type}-${c.productName}-${idx}`}
                className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  c.type === 'new'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                    : c.type === 'void'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
                }`}
              >
                {c.type === 'new' && `+ NEW ${c.quantity}x ${c.productName}`}
                {c.type === 'void' && `- VOID ${c.quantity}x ${c.productName}`}
                {c.type === 'qty_change' &&
                  `~ CHG ${c.oldQuantity || 1}→${c.quantity}x ${c.productName}`}
              </span>
            ))}
          </div>
          <Button
            onClick={onFireDelta}
            loading={firingDelta}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            size="sm"
          >
            <Flame size={14} className="mr-1.5" />
            Fire Changes & Print Delta KOT
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {sentItems.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Already sent to kitchen
            </h3>
            <ul className="space-y-2">
              {sentItems.map((it) => {
                const isVoided = !!voidedItems[it.id] || it.status === 'voided'
                const currentQty = itemQuantities[it.id] ?? it.quantity
                const currentNotes = itemNotesDraft[it.id] ?? it.notes ?? ''
                return (
                  <li
                    key={it.id}
                    className={`rounded-lg border px-3 py-2 ${
                      isVoided
                        ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30 opacity-75'
                        : 'border-gray-200 dark:border-dark-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${
                            isVoided ? 'line-through' : ''
                          }`}
                        >
                          {currentQty} × {it.productName}
                        </p>
                        {it.modifiers?.length > 0 && (
                          <p className="text-[11px] italic text-gray-500">* {it.modifiers.join(', ')}</p>
                        )}
                        {isVoided && (
                          <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5">
                            VOIDED: {voidedItems[it.id] || 'Voided'}
                          </p>
                        )}
                      </div>
                      {!isVoided && <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />}
                    </div>

                    {canEditExisting && !isVoided && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 bg-white dark:bg-dark-elevated rounded-lg border border-gray-200 dark:border-dark-border-strong px-1">
                            <button
                              type="button"
                              onClick={() => onExistingQty?.(it.id, Math.max(1, currentQty - 1))}
                              className="w-7 h-7 flex items-center justify-center"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{currentQty}</span>
                            <button
                              type="button"
                              onClick={() => onExistingQty?.(it.id, currentQty + 1)}
                              className="w-7 h-7 flex items-center justify-center"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRequestVoid?.(it.id)}
                            className="text-[11px] font-bold text-red-600 dark:text-red-400 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40"
                          >
                            Void
                          </button>
                        </div>
                        <Input
                          placeholder="Kitchen notes"
                          value={currentNotes}
                          onChange={(e) => onExistingNotes?.(it.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {canEditExisting && isVoided && voidedItems[it.id] && (
                      <button
                        type="button"
                        onClick={() => onUndoVoid?.(it.id)}
                        className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                      >
                        Undo void
                      </button>
                    )}

                    {it.sentToKitchenAt && !isVoided && (
                      <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                        <Clock size={10} />
                        {formatSentTime(it.sentToKitchenAt)}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {newCount > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
              New items to print
            </h3>
            <ul className="space-y-2">
              {unprintedServerItems.map((it) => (
                <li
                  key={it.id}
                  className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {it.quantity} × {it.productName}
                  </p>
                  {it.modifiers?.length > 0 && (
                    <p className="text-[11px] italic text-gray-600 dark:text-gray-400">* {it.modifiers.join(', ')}</p>
                  )}
                  {it.notes && <p className="text-[11px] italic text-red-600 dark:text-red-400">{it.notes}</p>}
                  <p className="text-xs font-semibold mt-1">{formatINR(it.unitPrice * it.quantity)}</p>
                </li>
              ))}
              {pendingItems.map((it) => (
                <li
                  key={it.tempId}
                  className="rounded-lg border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-950/40 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{it.productName}</p>
                      {it.modifiers.length > 0 && (
                        <p className="text-[11px] italic text-gray-600 dark:text-gray-400">* {it.modifiers.join(', ')}</p>
                      )}
                      {it.notes && <p className="text-[11px] italic text-red-600 dark:text-red-400">{it.notes}</p>}
                    </div>
                    <button type="button" onClick={() => onRemovePending(it.tempId)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 bg-white dark:bg-dark-elevated rounded-lg border border-gray-200 dark:border-dark-border-strong px-1">
                      <button type="button" onClick={() => onPendingQty(it.tempId, it.quantity - 1)} className="w-7 h-7 flex items-center justify-center">
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                      <button type="button" onClick={() => onPendingQty(it.tempId, it.quantity + 1)} className="w-7 h-7 flex items-center justify-center">
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-xs font-semibold">{formatINR(it.unitPrice * it.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sentItems.length === 0 && newCount === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Tap a menu item to start this bill.</p>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 dark:border-dark-border p-4 space-y-1 text-sm">
        <div className="flex justify-between text-gray-500 dark:text-gray-400">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-500 dark:text-gray-400">
          <span>Tax</span>
          <span>{formatINR(tax)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 text-base pt-1">
          <span>Total</span>
          <span>{formatINR(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
