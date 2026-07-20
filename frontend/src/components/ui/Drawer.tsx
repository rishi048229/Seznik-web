import { type ReactNode, Fragment } from 'react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  position?: 'left' | 'right'
}

export const Drawer = ({ isOpen, onClose, title, children, position = 'right' }: DrawerProps) => {
  if (!isOpen) return null

  return (
    <Fragment>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div
        className={`fixed top-0 bottom-0 ${position === 'right' ? 'right-0' : 'left-0'} z-50 w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform`}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto h-full">{children}</div>
      </div>
    </Fragment>
  )
}
