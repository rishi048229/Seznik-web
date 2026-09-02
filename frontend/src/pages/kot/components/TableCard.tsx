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
      className={`group relative text-left overflow-hidden rounded-2xl border p-4 min-h-[148px] transition-all duration-200 ${
        occupied
          ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 dark:from-rose-950/40 dark:via-gray-900 dark:to-amber-950/20 dark:border-rose-800/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-200/40 dark:hover:shadow-rose-950/40'
          : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-sky-950/20 dark:border-emerald-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-200/40 dark:hover:shadow-emerald-950/40'
      }`}
    >
      <div
        className={`absolute top-0 left-0 w-1.5 h-full ${occupied ? 'bg-rose-500' : 'bg-emerald-500'}`}
      />

      <div className="flex items-start justify-between gap-2 pl-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {table.capacity ? `${table.capacity} seats` : 'Open seating'}
        </p>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            occupied
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-200'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${occupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
          {occupied ? 'Occupied' : 'Vacant'}
        </span>
      </div>

      <h3 className="pl-1 mt-3 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 truncate">
        {table.name}
      </h3>

      <div className="pl-1 mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Users size={13} />
        <span>{occupied ? 'Guests seated' : 'Ready for guests'}</span>
      </div>

      {occupied && table.activeOrder ? (
        <div className="mt-3 pl-1 pt-3 border-t border-rose-100 dark:border-rose-900/50 flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">
              {formatINR(table.activeOrder.totalAmount)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              #{table.activeOrder.orderNumber} · {table.activeOrder.itemsCount} item
              {table.activeOrder.itemsCount === 1 ? '' : 's'}
            </p>
          </div>
          <p className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock size={12} />
            {formatElapsed(table.activeOrder.createdAt)}
          </p>
        </div>
      ) : (
        <p className="pl-1 mt-4 text-xs font-medium text-emerald-700 dark:text-emerald-300">Tap to open a bill</p>
      )}
    </button>
  )
}
