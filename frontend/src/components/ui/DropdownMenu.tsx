import { type ReactNode, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

const MENU_MIN_WIDTH = 220

export const DropdownMenu = ({ trigger, children, align = 'right' }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(MENU_MIN_WIDTH, menuRef.current?.offsetWidth ?? MENU_MIN_WIDTH)
    const height = menuRef.current?.offsetHeight ?? 0
    let left = align === 'right' ? rect.right - width : rect.left
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
    let top = rect.bottom + 8
    if (top + height > window.innerHeight - 8 && rect.top > height + 8) {
      top = rect.top - height - 8
    }
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, align])

  useEffect(() => {
    if (!isOpen) return
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [isOpen, align])

  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-flex"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((open) => !open)
        }}
      >
        {trigger}
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 80, minWidth: MENU_MIN_WIDTH }}
            className={clsx(
              'bg-white dark:bg-gray-800',
              'rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
              'py-1',
              'animate-in fade-in zoom-in-95 duration-150'
            )}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  )
}

export const DropdownMenuItem = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onClick?.()
      }}
      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2"
    >
      {children}
    </button>
  )
}
