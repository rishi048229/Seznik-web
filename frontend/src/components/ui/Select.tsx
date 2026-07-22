import { useState, useRef, useEffect, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ChevronDown, Check } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cn(...inputs: any[]): string {
  return twMerge(clsx(inputs))
}

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  value?: string
  onChange?: (e: { target: { value: string, name?: string } }) => void
  className?: string
  id?: string
  name?: string
  disabled?: boolean
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, name, value, onChange, disabled, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const selectRef = useRef<HTMLDivElement>(null)
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    const selectedOption = options.find(opt => opt.value === value)
    const displayValue = selectedOption?.label || placeholder || ''

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (optionValue: string) => {
      setIsOpen(false)
      if (onChange) {
        onChange({ target: { value: optionValue, name } })
      }
    }

    return (
      <div className="w-full" ref={ref}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {/* Select Trigger */}
          <button
            id={selectId}
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              'w-full px-4 py-2.5 pr-10 border rounded-lg cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
              'bg-white dark:bg-gray-800 dark:text-gray-100 text-gray-900',
              'transition-all duration-200',
              'hover:border-gray-400 dark:hover:border-gray-500',
              'border-gray-300 dark:border-gray-600',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              'text-left',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            {...props}
          >
            <span className={cn(!selectedOption && 'text-gray-400 dark:text-gray-500')}>
              {displayValue}
            </span>
          </button>
          
          {/* Dropdown Arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
            <ChevronDown size={18} className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
          </div>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className={cn(
              'absolute z-50 mt-2 w-full',
              'bg-white dark:bg-gray-800',
              'rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
              'py-1 max-h-60 overflow-y-auto',
              'animate-in fade-in slide-in-from-top-2 duration-200'
            )}>
              {placeholder && !value && (
                <div className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500">
                  {placeholder}
                </div>
              )}
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm',
                    'text-gray-900 dark:text-gray-100',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'transition-colors duration-150',
                    'flex items-center justify-between',
                    value === opt.value && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  )}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
