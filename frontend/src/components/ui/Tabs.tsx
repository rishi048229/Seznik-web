import { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface TabsProps {
  tabs: { key: string; label: string; icon?: ReactNode }[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}

export const Tabs = ({ tabs, activeTab, onChange, className }: TabsProps) => {
  return (
    <div className={clsx('border-b border-gray-200 dark:border-gray-700', className)}>
      <div className="flex overflow-x-auto scrollbar-hide -mb-px">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={clsx(
              'flex-shrink-0 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
