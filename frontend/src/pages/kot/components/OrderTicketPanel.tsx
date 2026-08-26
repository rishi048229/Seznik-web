import { Check, Clock, Minus, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { formatINR } from '@/utils/currency'
import { formatSentTime } from '../kotUtils'
import { ORDER_TYPE_OPTIONS } from '../kotConfig'
import type { KOTDraftItem, KOTOrderItem, KOTOrderType } from '@/types/kot.types'

interface OrderTicketPanelProps {
  tableName: string
  orderNumber?: number
  orderType: KOTOrderType
  onOrderTypeChange: (type: KOTOrderType) => void
  waiterName: string
  onWaiterChange: (value: string) => void
  sentItems: KOTOrderItem[]
  unprintedServerItems: KOTOrderItem[]
  pendingItems: KOTDraftItem[]
  onPendingQty: (tempId: string, qty: number) => void
  onRemovePending: (tempId: string) => void
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
  sentItems,
  unprintedServerItems,
  pendingItems,
  onPendingQty,
  onRemovePending,
  subtotal,
  tax,
  grandTotal,
}: OrderTicketPanelProps) => {
  const newCount = unprintedServerItems.length + pendingItems.length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{tableName}</h2>
          {orderNumber != null && (
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">#KOT-{orderNumber}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {ORDER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onOrderTypeChange(opt.id)}
              className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border ${
                orderType === opt.id
                  ? 'border-[#0a0a2e] bg-[#0a0a2e] text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Waiter / server name"
          value={waiterName}
          onChange={(e) => onWaiterChange(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {sentItems.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Already sent to kitchen
            </h3>
            <ul className="space-y-2">
              {sentItems.map((it) => (
                <li key={it.id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {it.quantity} × {it.productName}
                      </p>
                      {it.modifiers?.length > 0 && (
                        <p className="text-[11px] italic text-gray-500">* {it.modifiers.join(', ')}</p>
                      )}
                      {it.notes && <p className="text-[11px] italic text-red-600 dark:text-red-400">{it.notes}</p>}
                    </div>
                    <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  </div>
                  {it.sentToKitchenAt && (
                    <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                      <Clock size={10} />
                      {formatSentTime(it.sentToKitchenAt)}
                    </p>
                  )}
                </li>
              ))}
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
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 px-1">
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

      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 space-y-1 text-sm">
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
