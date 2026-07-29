import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface FieldInfoProps {
  /** Plain-language explanation of what the field means and what to enter. */
  text: string
}

// Small "i" bubble placed next to a form field label. Click (or hover on
// desktop) reveals a plain-language explanation of what to fill in. Click
// toggling (not just hover) keeps it usable on touch screens.
export const FieldInfo = ({ text }: FieldInfoProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="What is this field?"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1.5 w-4 h-4 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-blue-600 focus:outline-none focus:text-blue-600 transition-colors"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 sm:w-64 p-2.5 rounded-lg bg-gray-900 text-white text-[11px] leading-relaxed shadow-xl pointer-events-none"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}
