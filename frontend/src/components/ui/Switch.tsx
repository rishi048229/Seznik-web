import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  /** Optional info/tooltip element (e.g. a FieldInfo "i" button) rendered right after the label text. */
  info?: ReactNode
}

export const Switch = ({ checked, onChange, label, description, info }: SwitchProps) => {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer group">
      <span className="min-w-0">
        <span className="flex items-center text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
          {info}
        </span>
        {description && <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  )
}
