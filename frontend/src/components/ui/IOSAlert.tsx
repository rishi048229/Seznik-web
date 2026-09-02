import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

interface IOSAlertProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  destructive?: boolean
}

export const IOSAlert = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  onConfirm,
  destructive = false,
}: IOSAlertProps) => {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm?.()
    onClose()
  }

  const isDualAction = Boolean(cancelLabel)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-ios-alert-overlay">
      <button
        type="button"
        aria-label="Dismiss alert"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ios-alert-title"
        aria-describedby={message ? 'ios-alert-message' : undefined}
        className="relative z-10 w-[min(270px,78vw)] overflow-hidden rounded-[14px] bg-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-[20px] backdrop-saturate-[180%] animate-ios-alert-pop dark:bg-[rgba(44,44,46,0.92)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-[19px] pb-[15px] text-center">
          <h3
            id="ios-alert-title"
            className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-black dark:text-white"
          >
            {title}
          </h3>
          {message && (
            <p
              id="ios-alert-message"
              className="mt-1 text-[13px] leading-[18px] text-black/80 dark:text-white/80"
            >
              {message}
            </p>
          )}
        </div>

        <div className="h-px bg-black/10 dark:bg-white/15" />

        {isDualAction ? (
          <div className="flex">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-[11px] text-[17px] font-normal text-[#007AFF] transition-opacity active:opacity-50 dark:text-[#0A84FF]"
            >
              {cancelLabel}
            </button>
            <div className="w-px bg-black/10 dark:bg-white/15" />
            <button
              type="button"
              onClick={handleConfirm}
              className={clsx(
                'flex-1 py-[11px] text-[17px] font-semibold transition-opacity active:opacity-50',
                destructive ? 'text-[#FF3B30] dark:text-[#FF453A]' : 'text-[#007AFF] dark:text-[#0A84FF]'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-[11px] text-[17px] font-normal text-[#007AFF] transition-opacity active:opacity-50 dark:text-[#0A84FF]"
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
