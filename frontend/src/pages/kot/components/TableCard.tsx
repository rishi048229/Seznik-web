import { Clock, Users } from 'lucide-react'
import { formatINR } from '@/utils/currency'
import { formatElapsed } from '../kotUtils'
import type { RestaurantTable } from '@/types/kot.types'

interface TableCardProps {
  table: RestaurantTable
  onClick: () => void
}

export const TableCard = ({ table, onClick }: TableCardProps) => {
  const occupied = table.isOccupied && !!table.activeOrder

  return (
    <button
      type="button"
      onClick={onClick}
        className={`text-left rounded-2xl border p-3 sm:p-4 transition-colors duration-150 ${
        occupied
          ? 'border-red-300 bg-red-50/70 dark:bg-red-950/25 dark:border-red-500/50 hover:border-red-400 dark:hover:border-red-400'
          : 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/25 dark:border-emerald-500/50 hover:border-emerald-400 dark:hover:border-emerald-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{table.name}</h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            occupied
              ? 'bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-200'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${occupied ? 'bg-red-500' : 'bg-emerald-500'}`} />
          {occupied ? 'Occupied' : 'Vacant'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-2">
        <Users size={13} />
        <span>{table.capacity ? `${table.capacity} seats` : 'Seats not set'}</span>
      </div>

      {occupied && table.activeOrder && (
        <div className="mt-2 pt-2 border-t border-red-200/70 dark:border-red-800/50 space-y-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatINR(table.activeOrder.totalAmount)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            KOT #{table.activeOrder.orderNumber} · {table.activeOrder.itemsCount} item{table.activeOrder.itemsCount === 1 ? '' : 's'}
          </p>
          <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Clock size={12} />
            {formatElapsed(table.activeOrder.createdAt)}
          </p>
        </div>
      )}
    </button>
  )
}
