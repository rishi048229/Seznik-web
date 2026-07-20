import { type ReactNode, useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

export const DropdownMenu = ({ trigger, children, align = 'right' }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-2',
            'bg-white dark:bg-gray-800',
            'rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
            'py-1 min-w-[180px]',
            'animate-in fade-in slide-in-from-top-2 duration-200',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export const DropdownMenuItem = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
  return (
    <button
      onClick={() => { onClick?.(); }}
      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2"
    >
      {children}
    </button>
  )
}
