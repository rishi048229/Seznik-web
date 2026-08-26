import { formatINR } from '@/utils/currency'
import { LayoutGrid, CircleDot, Circle, IndianRupee } from 'lucide-react'

interface FloorStatsBarProps {
  total: number
  occupied: number
  vacant: number
  revenue: number
  tableLabel?: string
  showFloor?: boolean
  openCount?: number
}

export const FloorStatsBar = ({
  total,
  occupied,
  vacant,
  revenue,
  tableLabel = 'Tables',
  showFloor = true,
  openCount = 0,
}: FloorStatsBarProps) => {
  const stats = showFloor
    ? [
        { label: `Total ${tableLabel}`, value: String(total), icon: LayoutGrid, accent: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
        { label: 'Occupied', value: String(occupied), icon: CircleDot, accent: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' },
        { label: 'Vacant', value: String(vacant), icon: Circle, accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
        { label: 'Open tickets', value: formatINR(revenue), icon: IndianRupee, accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
      ]
    : [
        { label: 'Open bills', value: String(openCount), icon: CircleDot, accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
        { label: 'Open tickets', value: formatINR(revenue), icon: IndianRupee, accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
      ]

  return (
    <div className={`grid gap-2 sm:gap-3 mb-4 sm:mb-5 ${showFloor ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
      {stats.map(({ label, value, icon: Icon, accent }) => (
        <div
          key={label}
          className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 sm:px-3.5 sm:py-3"
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
