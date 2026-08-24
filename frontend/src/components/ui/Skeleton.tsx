import { clsx } from 'clsx'

interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string
  height?: string
  className?: string
}

export const Skeleton = ({ variant = 'text', width, height, className }: SkeletonProps) => {
  return (
    <div
      className={clsx(
        'skeleton-shimmer bg-gray-200 dark:bg-gray-700/80',
        {
          'h-4 w-full': variant === 'text',
          'rounded-full': variant === 'circular',
          'rounded': variant === 'rectangular',
        },
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
