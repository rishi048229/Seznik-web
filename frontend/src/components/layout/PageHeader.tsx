import { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface PageHeaderProps {
  title: string
  breadcrumb?: string[]
  action?: ReactNode
  className?: string
}

export const PageHeader = ({ title, breadcrumb, action, className }: PageHeaderProps) => {
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
