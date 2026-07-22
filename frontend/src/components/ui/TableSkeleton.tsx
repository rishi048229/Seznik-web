import { Skeleton } from './Skeleton'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export const TableSkeleton = ({ rows = 6, columns = 5 }: TableSkeletonProps) => {
  return (
    <div className="w-full space-y-3 animate-fadeIn">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton variant="text" className="h-3.5 w-24" />
          </div>
        ))}
      </div>

      {/* Rows Skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1 flex items-center gap-2">
              {colIndex === 0 && <Skeleton variant="circular" className="w-7 h-7 flex-shrink-0" />}
              <Skeleton
                variant="text"
                className={`h-4 ${colIndex === 0 ? 'w-32' : colIndex === columns - 1 ? 'w-16 ml-auto' : 'w-24'}`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
