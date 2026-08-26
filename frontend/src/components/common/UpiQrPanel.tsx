import { useEffect, useRef } from 'react'
import { QrCode } from 'lucide-react'
import { drawUpiQrToCanvas } from '@/utils/upiQr'
import { formatINR } from '@/utils/currency'

interface UpiQrPanelProps {
  upiId: string
  payeeName: string
  amount: number
}

/**
 * Live, amount-encoded UPI QR shown during checkout (before the sale is
 * created) — purely informational, same as the cash/card steps: the cashier
 * still manually confirms payment, this doesn't call any payment gateway.
 */
export function UpiQrPanel({ upiId, payeeName, amount }: UpiQrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && upiId && amount > 0) {
      drawUpiQrToCanvas(canvasRef.current, { upiId, payeeName, amount }, 176).catch(() => {})
    }
  }, [upiId, payeeName, amount])

  if (!upiId || amount <= 0) return null

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
        <QrCode size={14} />
        Scan &amp; Pay {formatINR(amount)}
      </div>
      <canvas ref={canvasRef} className="rounded-lg bg-white p-1.5" />
      <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 text-center">
        Customer scans with any UPI app, then confirm payment below once received.
      </p>
    </div>
  )
}
