import { useEffect, useRef, useCallback } from 'react'
import type { BarcodeScanMode } from '@/types/barcode.types'

interface UseBarcodeScannerProps {
  mode: BarcodeScanMode
  onScan: (barcode: string) => void
  enabled?: boolean
}

export const useBarcodeScanner = ({ mode, onScan, enabled = true }: UseBarcodeScannerProps): void => {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(0)
  const SCAN_THRESHOLD_MS = 100

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Skip if a text input is focused
    const active = document.activeElement
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)
    ) {
      // Allow scanner input only when explicitly in scan mode and no regular input is focused
      // If the focused element is a regular text field, skip scanner
      return
    }

    // Ignore modifier keys
    if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return

    const now = Date.now()
    const timeDelta = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      const barcode = buffer.current.trim()
      if (barcode.length >= 4) {
        onScan(barcode)
      }
      buffer.current = ''
      return
    }

    // If gap > threshold, it's the start of a new scan (reset buffer)
    if (timeDelta > SCAN_THRESHOLD_MS && buffer.current.length > 0) {
      buffer.current = ''
    }

    buffer.current += e.key
  }, [enabled, onScan])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
