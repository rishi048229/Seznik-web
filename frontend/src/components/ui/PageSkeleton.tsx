import { Skeleton } from './Skeleton'
import { TableSkeleton } from './TableSkeleton'

export const StatCardsSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="h-3.5 w-24" />
          <Skeleton variant="circular" className="w-9 h-9" />
        </div>
        <Skeleton variant="text" className="h-7 w-32" />
        <Skeleton variant="text" className="h-3 w-20" />
      </div>
    ))}
  </div>
)

export const TablePageSkeleton = ({
  cards = 4,
  rows = 6,
  columns = 5,
  showCards = true,
}: {
  cards?: number
  rows?: number
  columns?: number
  showCards?: boolean
}) => (
  <div className="space-y-6 w-full animate-fadeIn">
    {/* Page Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-11 h-11" />
        <div className="space-y-2">
          <Skeleton variant="text" className="h-5 w-40" />
          <Skeleton variant="text" className="h-3.5 w-60" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-10 w-28 rounded-xl" />
        <Skeleton variant="rectangular" className="h-10 w-32 rounded-xl" />
      </div>
    </div>

    {/* Stat Cards Skeleton */}
    {showCards && <StatCardsSkeleton count={cards} />}

    {/* Search & Filter Bar Skeleton */}
    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
      <Skeleton variant="rectangular" className="h-10 w-full sm:w-72 rounded-xl" />
      <div className="flex gap-2 w-full sm:w-auto">
        <Skeleton variant="rectangular" className="h-10 w-28 rounded-xl" />
        <Skeleton variant="rectangular" className="h-10 w-28 rounded-xl" />
      </div>
    </div>

    {/* Table Skeleton */}
    <TableSkeleton rows={rows} columns={columns} />
  </div>
)

export const DashboardSkeleton = () => (
  <div className="space-y-6 w-full animate-fadeIn">
    {/* Welcome Header */}
    <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/40 flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      <Skeleton variant="rectangular" className="h-10 w-32 rounded-xl" />
    </div>

    {/* Stat Cards */}
    <StatCardsSkeleton count={4} />

    {/* Charts & Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <Skeleton variant="text" className="h-5 w-40" />
        <Skeleton variant="rectangular" className="h-64 w-full rounded-xl" />
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <Skeleton variant="text" className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton variant="circular" className="w-8 h-8" />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" className="h-3.5 w-full" />
              <Skeleton variant="text" className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

export const POSPageSkeleton = () => (
  <div className="flex flex-col lg:flex-row gap-6 w-full h-full animate-fadeIn">
    {/* Left Panel: Catalog Skeleton */}
    <div className="flex-1 space-y-5">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
        <Skeleton variant="rectangular" className="h-10 w-full rounded-xl" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" className="h-8 w-24 rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <Skeleton variant="rectangular" className="h-28 w-full rounded-xl" />
            <Skeleton variant="text" className="h-4 w-3/4" />
            <div className="flex justify-between items-center">
              <Skeleton variant="text" className="h-5 w-16" />
              <Skeleton variant="circular" className="w-7 h-7" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Right Panel: Cart Skeleton */}
    <div className="w-full lg:w-96 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
          <Skeleton variant="text" className="h-5 w-28" />
          <Skeleton variant="text" className="h-4 w-16" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton variant="text" className="h-4 w-32" />
              <Skeleton variant="text" className="h-3 w-20" />
            </div>
            <Skeleton variant="rectangular" className="h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between">
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton variant="text" className="h-4 w-24" />
        </div>
        <Skeleton variant="rectangular" className="h-12 w-full rounded-xl" />
      </div>
    </div>
  </div>
)

export const SettingsPageSkeleton = () => (
  <div className="space-y-6 w-full animate-fadeIn">
    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" className="h-9 w-32 rounded-xl" />
      ))}
    </div>
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="text" className="h-4 w-28" />
            <Skeleton variant="rectangular" className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <Skeleton variant="rectangular" className="h-10 w-36 rounded-xl ml-auto" />
    </div>
  </div>
)
