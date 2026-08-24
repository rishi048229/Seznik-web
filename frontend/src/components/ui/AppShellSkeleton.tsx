import { type ReactNode } from 'react'
import { Skeleton } from './Skeleton'

interface AppShellSkeletonProps {
  children: ReactNode
}

export const AppShellSkeleton = ({ children }: AppShellSkeletonProps) => (
  <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900" aria-busy="true" aria-label="Loading page">
    <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-3 px-2 pb-6">
        <Skeleton variant="rectangular" className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-4 w-28" />
          <Skeleton variant="text" className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <Skeleton variant="circular" className="h-5 w-5 flex-shrink-0" />
            <Skeleton variant="text" className={`h-3.5 ${i % 3 === 0 ? 'w-24' : 'w-32'}`} />
          </div>
        ))}
      </div>
    </aside>

    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800 px-3 lg:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton variant="circular" className="h-9 w-9 lg:hidden" />
          <Skeleton variant="text" className="h-5 w-36 sm:w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="h-9 w-9" />
          <Skeleton variant="circular" className="h-9 w-9" />
          <Skeleton variant="circular" className="h-9 w-9 hidden sm:block" />
          <Skeleton variant="circular" className="h-9 w-9" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
        {children}
      </main>
    </div>
  </div>
)
