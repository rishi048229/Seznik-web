import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
}

export const Modal = ({ isOpen, onClose, title, size = 'md', children, footer }: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative z-10 bg-white dark:bg-gray-800 shadow-xl w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col min-w-0 pointer-events-auto',
          'rounded-t-2xl sm:rounded-xl',
          sizeClasses[size]
        )}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 shrink-0 gap-3 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 -mr-1 shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div
            className="relative z-20 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 pointer-events-auto bg-white dark:bg-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onPointerDown={e => e.stopPropagation()}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
