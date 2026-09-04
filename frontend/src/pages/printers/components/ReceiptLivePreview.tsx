import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Scissors } from 'lucide-react'
import { compileReceiptTextLines, getCols } from '@/utils/receiptEngine'
import { getUpiQrImageUrl } from '@/utils/upiQr'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { isRestaurantReceiptTemplate } from '@/utils/restaurantReceiptTemplate'
import { CustomReceiptPreview } from '../receipt-builder/CustomReceiptPreview'
import type { ReceiptPrintContext } from '@/utils/customReceiptEngine'
import { receiptLogoHtmlMaxPxFromChip, receiptStandardQrHtmlPxFromChip } from '@shared/receiptPrintGeometry'
import { receiptFontCssFamily, resolveReceiptFontId, type ReceiptFontId } from '@shared/receiptFonts'
import { getReceiptPreviewMaxWidth } from '../receipt-builder/receiptPreviewStyles'

interface ReceiptLivePreviewProps {
  paperSize: '58mm' | '80mm'
  receiptConfig: ReceiptConfig
  settings?: UserSettings | null
  showLogo: boolean
  cutPaper: boolean
  activeTemplate?: CustomReceiptTemplate | null
  isRestaurant?: boolean
  receiptFont?: ReceiptFontId | null
}

export const ReceiptLivePreview = ({
  paperSize,
  receiptConfig,
  settings,
  showLogo,
  cutPaper,
  activeTemplate,
  isRestaurant = false,
  receiptFont,
}: ReceiptLivePreviewProps) => {
  const effectiveFont = resolveReceiptFontId(receiptFont ?? settings?.printerConfig?.receiptFont)
  const cols = getCols(paperSize, undefined, effectiveFont)
  const stageRef = useRef<HTMLDivElement>(null)
  const slipRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ scale: 1, height: 0 })

  const isRest = isRestaurant || isRestaurantReceiptTemplate(activeTemplate ?? undefined)

  const previewContext: ReceiptPrintContext = useMemo(() => {
    const items = isRest
      ? [
          { productName: 'Butter Chicken', quantity: 1, unitPrice: 380, total: 380, gstRate: 5 },
          { productName: 'Garlic Naan', quantity: 3, unitPrice: 60, total: 180, gstRate: 5 },
          { productName: 'Fresh Lime Soda', quantity: 2, unitPrice: 70, total: 140, gstRate: 5 },
        ]
      : [
          { productName: 'Wireless Keyboard', quantity: 1, unitPrice: 1499, total: 1499, gstRate: 18 },
          { productName: 'Optical Mouse Pro', quantity: 2, unitPrice: 600, total: 1200, gstRate: 18 },
          { productName: 'Fresh Milk 1L', quantity: 2, unitPrice: 30, total: 60, gstRate: 0 },
        ]
    const subtotal = items.reduce((s, it) => s + it.total, 0)
    const totalTax = isRest ? 35 : 411.71
    const grandTotal = subtotal + (isRest ? totalTax : 0)

    return {
      storeName: receiptConfig.companyName || settings?.businessName || 'SEZNIK POS STORE',
      storeAddress: receiptConfig.address || settings?.businessAddress || '',
      storePhone: receiptConfig.phone || settings?.businessPhone || '',
      storeGstin: receiptConfig.gstin || settings?.businessGSTIN || '',
      storeLogoUrl: showLogo ? (receiptConfig.logoURL || settings?.businessLogoURL || '') : undefined,
      upiId: receiptConfig.upiId || settings?.upiId,
      invoiceNumber: 'INV/2026/00142',
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: '',
      customerPhone: '',
      items,
      subtotal,
      totalDiscount: 0,
      totalTax,
      grandTotal,
      amountPaid: grandTotal,
      changeReturned: 0,
      paymentMethod: 'CASH',
      footerMessage: receiptConfig.footerMessage || (isRest ? 'Thank you! Visit again.' : 'Thank you for your purchase!'),
      tableNo: isRest ? 'T-4' : undefined,
      waiterName: isRest ? 'Raj' : undefined,
    }
  }, [receiptConfig, settings, showLogo, isRest])

  const sampleSale = useMemo(() => {
    return {
      id: 'preview-1',
      invoiceNumber: 'INV/2026/00142',
      items: previewContext.items.map((it, idx) => ({
        productId: `p${idx + 1}`,
        productName: it.productName,
        quantity: it.quantity,
        sellingPrice: it.unitPrice,
        discount: 0,
        taxRate: it.gstRate || 0,
        taxAmount: (it.total * (it.gstRate || 0)) / 100,
        total: it.total,
      })),
      subtotal: previewContext.subtotal,
      totalDiscount: 0,
      totalTax: previewContext.totalTax,
      grandTotal: previewContext.grandTotal,
      paymentMethod: 'cash' as const,
      amountPaid: previewContext.amountPaid || previewContext.grandTotal,
      changeReturned: 0,
      isQuickBill: false,
      createdAt: new Date().toISOString(),
    }
  }, [previewContext])

  const lines = useMemo(
    () =>
      compileReceiptTextLines({
        sale: sampleSale,
        receiptConfig,
        businessName: previewContext.storeName,
        businessAddress: previewContext.storeAddress,
        businessPhone: previewContext.storePhone,
        businessGSTIN: previewContext.storeGstin,
        customerName: '',
        customerPhone: '',
        paperSize,
        receiptFont: effectiveFont,
        isRestaurant: isRest,
      }),
    [sampleSale, receiptConfig, previewContext, paperSize, isRest, effectiveFont]
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
  }, [lines, paperSize, showLogo, receiptConfig.showPaymentQR, receiptConfig.upiId, receiptConfig.paymentQrURL, receiptConfig.logoURL, settings?.businessLogoURL, cutPaper, activeTemplate])

  const showQr = !!(receiptConfig.showPaymentQR && (receiptConfig.upiId || receiptConfig.paymentQrURL))
  const logoSrc = receiptConfig.logoURL || settings?.businessLogoURL || ''

  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-bg/60 p-3 sm:p-4 overflow-hidden">
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
            <div
              ref={slipRef}
              className="flex flex-col items-stretch"
              style={{
                width: activeTemplate
                  ? `${getReceiptPreviewMaxWidth(paperSize)}px`
                  : `calc(${cols}ch + 1.25rem)`,
              }}
            >
              {activeTemplate ? (
                <CustomReceiptPreview
                  template={activeTemplate}
                  context={previewContext}
                  gstOpts={{ receiptFont: effectiveFont }}
                />
              ) : (
                <div className="bg-white text-gray-900 rounded-t-xl shadow-lg border-t-8 border-blue-600 overflow-hidden">
                  {showLogo && logoSrc && (
                    <div className="flex justify-center px-2 pt-2.5 pb-2 border-b border-dashed border-gray-300">
                      <img
                        src={logoSrc}
                        alt="Store Logo"
                        className="object-contain"
                        style={{
                          maxHeight: `${receiptLogoHtmlMaxPxFromChip(receiptConfig.receiptLogoSize).maxHeight}px`,
                          maxWidth: `${receiptLogoHtmlMaxPxFromChip(receiptConfig.receiptLogoSize).maxWidth}px`,
                        }}
                      />
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
                      fontFamily: receiptFontCssFamily(effectiveFont),
                    }}
                  >
                    {lines.join('\n')}
                  </pre>
                  {showQr && (
                    <div className="px-2 pb-2 pt-2 border-t border-dashed border-gray-300 text-center flex flex-col items-center">
                      <span className="text-[9px] font-bold tracking-wider text-gray-800 mb-1">
                        SCAN TO PAY VIA UPI
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
                        style={{
                          width: `${receiptStandardQrHtmlPxFromChip(receiptConfig.receiptQrSize)}px`,
                          height: `${receiptStandardQrHtmlPxFromChip(receiptConfig.receiptQrSize)}px`,
                        }}
                        className="object-contain border border-gray-200 rounded p-1 bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
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
