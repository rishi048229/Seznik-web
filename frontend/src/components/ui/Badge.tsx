import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cn(...inputs: any[]): string {
  return twMerge(clsx(inputs))
}

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | string
  children: ReactNode
  className?: string
}

export const Badge = ({ variant = 'default', size: _size, children, className }: BadgeProps) => {
  const resolvedVariant =
    variant === 'primary' ? 'info' : variant === 'secondary' ? 'default' : variant
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-gray-100 text-gray-800 dark:bg-dark-elevated dark:text-gray-200 dark:border dark:border-dark-border-strong': resolvedVariant === 'default',
          'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200': resolvedVariant === 'success',
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200': resolvedVariant === 'warning',
          'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200': resolvedVariant === 'danger',
          'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200': resolvedVariant === 'info',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
