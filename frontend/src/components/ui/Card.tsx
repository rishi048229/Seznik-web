import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: (string | undefined | false | null)[]): string {
  return twMerge(clsx(inputs))
}

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  'data-tour'?: string
}

export const Card = ({ children, className, onClick, ...rest }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  )
}
