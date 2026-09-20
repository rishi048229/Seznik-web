import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cn(...inputs: any[]): string {
  return twMerge(clsx(inputs))
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  isLoading?: boolean
  leftIcon?: ReactNode
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      loading = Boolean(isLoading),
      leftIcon,
      children,
      className,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-bg disabled:opacity-50 disabled:cursor-not-allowed',
          {
            // Light: brand blue→sky. Dark: soft off-white fill + dark text (calmer on pure black).
            'bg-gradient-to-r from-blue-600 to-sky-400 text-white hover:from-blue-700 hover:to-sky-500 focus:ring-blue-500 shadow-sm shadow-blue-500/20 dark:from-zinc-100 dark:to-zinc-100 dark:text-zinc-900 dark:hover:from-white dark:hover:to-white dark:focus:ring-zinc-400 dark:shadow-none':
              variant === 'primary',
            'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-dark-elevated dark:text-gray-100 dark:hover:bg-dark-hover dark:border dark:border-dark-border-strong dark:hover:border-white/20 dark:focus:ring-zinc-500/40':
              variant === 'secondary',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-600/90 dark:hover:bg-red-500 dark:focus:ring-red-400':
              variant === 'danger',
            'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-elevated dark:hover:text-white':
              variant === 'ghost',
            'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border-strong dark:text-gray-200 dark:hover:bg-white/5 dark:hover:border-white/25 dark:hover:text-white':
              variant === 'outline',
          },
          {
            'px-2.5 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
