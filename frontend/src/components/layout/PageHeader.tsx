import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Video } from 'lucide-react'

interface PageHeaderProps {
  title: string
  breadcrumb?: string[]
  action?: ReactNode
  className?: string
  onWatchTutorial?: () => void
}

export const PageHeader = ({ title, breadcrumb, action, className, onWatchTutorial }: PageHeaderProps) => {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6', className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-0.5">
            {breadcrumb.map((item, i) => (
              <span key={i}>
                {i > 0 && ' / '}
                {item}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
          {onWatchTutorial && (
            <button
              onClick={onWatchTutorial}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm shrink-0"
              title="Watch Video Guide & Tutorial"
            >
              <Video size={14} className="animate-pulse" />
              <span>Video Guide</span>
            </button>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
