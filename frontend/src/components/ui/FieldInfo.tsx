import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'

interface FieldInfoProps {
  /** Translation key for the explanation — resolved via t(), so it follows the app language automatically. */
  textKey: TranslationKey
}

const MAX_WIDTH = 260

// Small "i" bubble placed next to a form field label. Click (or hover on
// desktop) reveals a plain-language explanation of what to fill in. The
// tooltip is portaled to <body> and positioned in fixed coordinates computed
// from the trigger's own bounding box — so it can never get clipped by a
// scrollable modal body or pushed off-screen near a container edge, and it
// stays correctly placed if the page scrolls while it's open.
export const FieldInfo = ({ textKey }: FieldInfoProps) => {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.min(MAX_WIDTH, window.innerWidth - 16)
    const placement: 'top' | 'bottom' = rect.top > 130 ? 'top' : 'bottom'
    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8
    setCoords({ top, left, placement })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handle = () => updatePosition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (tooltipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="What is this field?"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1.5 w-4 h-4 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors align-middle"
      >
        <Info size={13} />
      </button>
      {open && coords && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: Math.min(MAX_WIDTH, window.innerWidth - 16),
            transform: coords.placement === 'top' ? 'translateY(-100%)' : undefined,
          }}
          className="z-[9999] p-2.5 rounded-lg bg-gray-900 text-white text-[11px] leading-relaxed shadow-xl pointer-events-none"
        >
          {t(textKey)}
        </div>,
        document.body
      )}
    </>
  )
}
