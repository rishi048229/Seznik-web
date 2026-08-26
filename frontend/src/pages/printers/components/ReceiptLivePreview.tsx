import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Scissors } from 'lucide-react'
import { compileReceiptTextLines, getCols } from '@/utils/receiptEngine'
import { getUpiQrImageUrl } from '@/utils/upiQr'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'

interface ReceiptLivePreviewProps {
  paperSize: '58mm' | '80mm'
  receiptConfig: ReceiptConfig
  settings?: UserSettings | null
  showLogo: boolean
  cutPaper: boolean
}

const SAMPLE_SALE = {
  id: 'preview-1',
  invoiceNumber: 'INV/2026/00142',
  items: [
    { productId: 'p1', productName: 'Wireless Keyboard', quantity: 1, sellingPrice: 1499, discount: 0, taxRate: 18, taxAmount: 228.66, total: 1499 },
    { productId: 'p2', productName: 'Optical Mouse Pro', quantity: 2, sellingPrice: 600, discount: 0, taxRate: 18, taxAmount: 183.05, total: 1200 },
    { productId: 'p3', productName: 'Fresh Milk 1L', quantity: 2, sellingPrice: 30, discount: 0, taxRate: 0, taxAmount: 0, total: 60 },
  ],
  subtotal: 2759,
  totalDiscount: 0,
  totalTax: 411.71,
  grandTotal: 2759,
  paymentMethod: 'cash' as const,
  amountPaid: 2759,
  changeReturned: 0,
  isQuickBill: false,
  createdAt: new Date().toISOString(),
}

export const ReceiptLivePreview = ({
  paperSize,
  receiptConfig,
  settings,
  showLogo,
  cutPaper,
}: ReceiptLivePreviewProps) => {
  const cols = getCols(paperSize)
  const stageRef = useRef<HTMLDivElement>(null)
  const slipRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ scale: 1, height: 0 })

  const lines = useMemo(
    () =>
      compileReceiptTextLines({
        sale: SAMPLE_SALE,
        receiptConfig,
        businessName: settings?.businessName || 'SEZNIK POS STORE',
        businessAddress: receiptConfig.address || settings?.businessAddress || '123 MG Road, Kothrud',
        businessPhone: receiptConfig.phone || '9876543210',
        businessGSTIN: receiptConfig.gstin || '27AAAAA0000A1Z5',
        customerName: 'Rahul Sharma',
        paperSize,
      }),
    [receiptConfig, settings, paperSize]
  )

  useLayoutEffect(() => {
    const stage = stageRef.current
    const slip = slipRef.current
    if (!stage || !slip) return

    const measure = () => {
      const available = stage.clientWidth
      const naturalW = slip.offsetWidth
      const naturalH = slip.offsetHeight
      const scale = naturalW > 0 ? Math.min(1, available / naturalW) : 1
      setMetrics({ scale, height: naturalH * scale })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    ro.observe(slip)
    return () => ro.disconnect()
  }, [lines, paperSize, showLogo, receiptConfig.showPaymentQR, receiptConfig.upiId, receiptConfig.paymentQrURL, receiptConfig.logoURL, settings?.businessLogoURL, cutPaper])

  const showQr = !!(receiptConfig.showPaymentQR && (receiptConfig.upiId || receiptConfig.paymentQrURL))
  const logoSrc = receiptConfig.logoURL || settings?.businessLogoURL || ''

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-3 sm:p-4 overflow-hidden">
      <div
        ref={stageRef}
        className="w-full max-h-[min(640px,calc(100dvh-12rem))] overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin"
      >
        <div className="relative mx-auto" style={{ height: metrics.height || undefined, width: '100%' }}>
          <div
            className="absolute top-0 left-1/2"
            style={{
              transform: `translateX(-50%) scale(${metrics.scale})`,
              transformOrigin: 'top center',
            }}
          >
            <div ref={slipRef} className="flex flex-col items-stretch" style={{ width: `calc(${cols}ch + 1.25rem)` }}>
              <div className="bg-white text-gray-900 rounded-t-xl shadow-lg border-t-8 border-blue-600 overflow-hidden">
                {showLogo && logoSrc && (
                  <div className="flex justify-center px-2 pt-2.5 pb-2 border-b border-dashed border-gray-300">
                    <img src={logoSrc} alt="Store Logo" className="max-h-10 object-contain" style={{ maxWidth: `${cols}ch` }} />
                  </div>
                )}
                <pre
                  className="m-0 py-2 whitespace-pre text-gray-900 overflow-hidden"
                  style={{
                    width: `${cols}ch`,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    fontSize: paperSize === '80mm' ? '12px' : '11px',
                    lineHeight: 1.35,
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: '"Courier New", Courier, ui-monospace, monospace',
                  }}
                >
                  {lines.join('\n')}
                </pre>
                {showQr && (
                  <div className="px-2 pb-2 pt-2 border-t border-dashed border-gray-300 text-center flex flex-col items-center">
                    <span className="text-[9px] font-bold tracking-wider text-gray-800 mb-1">
                      SCAN TO PAY ₹2,759.00 (UPI / QR)
                    </span>
                    <img
                      src={
                        receiptConfig.upiId
                          ? getUpiQrImageUrl(
                              {
                                upiId: receiptConfig.upiId,
                                payeeName: settings?.businessName || 'SEZNIK POS STORE',
                                amount: 2759,
                                note: 'INV/2026/00142',
                              },
                              140
                            )
                          : receiptConfig.paymentQrURL
                      }
                      alt="Payment QR Code"
                      className="w-24 h-24 object-contain border border-gray-200 rounded p-1 bg-white"
                    />
                  </div>
                )}
              </div>
              <div
                className="h-3 w-full bg-white shrink-0"
                style={{
                  backgroundImage: 'radial-gradient(circle at 6px 12px, rgb(241 245 249) 6px, transparent 6.5px)',
                  backgroundSize: '12px 12px',
                  backgroundRepeat: 'repeat-x',
                  backgroundPosition: '0 -6px',
                }}
              />
              {cutPaper && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-600 font-semibold mt-2.5 pb-0.5">
                  <Scissors size={12} /> Auto paper cutter enabled
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
