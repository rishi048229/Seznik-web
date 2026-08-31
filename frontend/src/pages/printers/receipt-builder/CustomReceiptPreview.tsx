import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ImageIcon } from 'lucide-react'
import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import {
  compileGstBreakdownPairs,
  interpolateReceiptVariables,
  resolveShowItemNumbers,
  resolveShowTaxColumn,
  type CustomReceiptGstOpts,
  type ReceiptPrintContext,
} from '@/utils/customReceiptEngine'
import { buildUpiPayLink, getUpiQrImageUrl, isValidUpiVpa } from '@/utils/upiQr'
import { getReceiptPreviewFontStyle, getReceiptPreviewMaxWidth } from './receiptPreviewStyles'
import { isReceiptEntryEnabled, resolveReceiptImageSrc } from '@/utils/receiptLogo'
import { receiptQrPreviewPx, receiptStandardQrHtmlPxFromChip } from '@shared/receiptPrintGeometry'

interface CustomReceiptPreviewProps {
  template: CustomReceiptTemplate
  context: ReceiptPrintContext
  gstOpts?: CustomReceiptGstOpts
  className?: string
}

const isDiscountEntry = (e: CustomReceiptEntry) =>
  e.type === 'left_right_text' && /discount/i.test(e.left + e.right)

const isTaxEntry = (e: CustomReceiptEntry) =>
  e.type === 'left_right_text' && /\btax\b/i.test(e.left + e.right)

function ReceiptLogoImage({
  src,
  fallbackSrc,
  widthPercent,
}: {
  src?: string
  fallbackSrc?: string
  widthPercent: number
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const activeSrc = src && failedSrc !== src ? src : fallbackSrc && failedSrc !== fallbackSrc ? fallbackSrc : undefined
  const w = `${Math.min(widthPercent, 100)}%`

  if (!activeSrc) {
    return null
  }

  return (
    <img
      src={activeSrc}
      alt="Logo"
      className="object-contain max-h-16 min-h-8"
      style={{ width: w, maxWidth: '100%' }}
      onError={() => setFailedSrc(activeSrc)}
    />
  )
}

export function CustomReceiptPreview({ template, context, gstOpts, className = '' }: CustomReceiptPreviewProps) {
  const paperWidth = template.paperWidth || '58mm'
  const paperMax = getReceiptPreviewMaxWidth(paperWidth)
  const fontStyle = getReceiptPreviewFontStyle(paperWidth)
  const logoUrl = context.storeLogoUrl
  const enabledEntries = template.entries.filter(isReceiptEntryEnabled)
  const hasEnabledImageBlock = enabledEntries.some((e) => e.type === 'image')

  const renderEntry = (entry: CustomReceiptEntry, idx: number) => {
    if (!isReceiptEntryEnabled(entry)) return null
    const vars = (t?: string) => interpolateReceiptVariables(t || '', context)

    switch (entry.type) {
      case 'text':
      case 'text_special': {
        const align = entry.align || 'left'
        const size =
          entry.type === 'text_special'
            ? Math.min(Math.max(entry.fontSizePt || 14, 10), 22)
            : entry.size === 'large'
              ? '1.15em'
              : entry.size === 'small'
                ? '0.92em'
                : '1em'
        const rawText = vars(entry.text)
        const cleaned = rawText
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .join('\n')
        if (!cleaned.trim()) return null
        return (
          <div key={entry.id || idx} className={`text-black whitespace-pre-wrap ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`} style={{ fontSize: size, fontWeight: entry.bold ? 700 : 500, fontFamily: 'inherit' }}>
            {cleaned}
          </div>
        )
      }
      case 'image': {
        const src = resolveReceiptImageSrc(entry, logoUrl)
        const w = entry.widthPercent || 60
        return (
          <div key={entry.id || idx} className={`flex my-1 ${entry.align === 'left' ? 'justify-start' : entry.align === 'right' ? 'justify-end' : 'justify-center'}`}>
            <ReceiptLogoImage src={src} fallbackSrc={logoUrl} widthPercent={w} />
          </div>
        )
      }
      case 'horizontal_line': {
        const style = entry.lineStyle === 'double' ? 'border-double border-b-2' : entry.lineStyle === 'dotted' ? 'border-dotted border-b' : entry.lineStyle === 'dashed' ? 'border-dashed border-b' : 'border-b'
        return <hr key={entry.id || idx} className={`my-1 border-black ${style}`} />
      }
      case 'barcode': {
        const isQr = entry.codeType === 'qr_code' || entry.format === 'qr'
        let rawVal = vars(entry.value)
        if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
          const upi = (entry.upiId || context.upiId || '').trim()
          if (!isValidUpiVpa(upi)) {
            return (
              <div key={entry.id || idx} className="my-2 text-center text-[10px] text-red-600 border border-dashed border-red-300 rounded px-2 py-3">
                Enter UPI ID to generate payment QR
              </div>
            )
          }
          rawVal = buildUpiPayLink({ upiId: upi, payeeName: context.storeName, amount: context.grandTotal, note: context.invoiceNumber })
        } else if (entry.qrType === 'digital_bill' || !rawVal || rawVal === '{{bill_pdf_url}}') {
          const targetId = encodeURIComponent(context.saleId || context.invoiceNumber || 'INV-2026-0042')
          rawVal = typeof window !== 'undefined'
            ? `${window.location.origin}/receipt/${targetId}`
            : `https://api.seznik.com/receipt/${targetId}`
        } else if (entry.qrType === 'invoice_barcode' || rawVal === '{{invoice_no}}') {
          rawVal = context.invoiceNumber || 'INV-2026-0042'
        }

        const isUpi = entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || Boolean(entry.upiId)
        const qrSize =
          isUpi || entry.qrType === 'digital_bill' || !entry.size
            ? receiptStandardQrHtmlPxFromChip(gstOpts?.receiptQrSize)
            : receiptQrPreviewPx(entry.size === 'large' || entry.size === 'small' ? entry.size : 'medium')
        return (
          <div key={entry.id || idx} className={`my-2 flex ${entry.align === 'left' ? 'justify-start' : entry.align === 'right' ? 'justify-end' : 'justify-center'}`}>
            {isQr ? (
              <div className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 inline-block">
                {isUpi ? (
                  <div className="text-[9px] font-bold tracking-wider text-center mb-1">SCAN TO PAY VIA UPI</div>
                ) : null}
                <QRCodeSVG
                  value={rawVal || 'https://seznik.com'}
                  size={qrSize}
                  level="M"
                  includeMargin={true}
                />
              </div>
            ) : (
              <span className="font-mono text-xs">*{rawVal}*</span>
            )}
          </div>
        )
      }
      case 'left_right_text': {
        if (isDiscountEntry(entry) && context.totalDiscount <= 0) return null
        if (isTaxEntry(entry)) {
          if (context.totalTax <= 0) return null
          const gstPairs = compileGstBreakdownPairs(context, gstOpts)
          if (gstPairs.length > 0) {
            return (
              <div key={entry.id || idx}>
                {gstPairs.map((pair, pairIdx) => (
                  <div
                    key={`${entry.id || idx}-gst-${pairIdx}`}
                    className="flex justify-between text-black my-0.5"
                    style={{ fontSize: '0.95em', fontFamily: 'inherit' }}
                  >
                    <span>{pair.left}</span>
                    <span>{pair.right}</span>
                  </div>
                ))}
              </div>
            )
          }
          if (gstOpts?.showTaxBreakdown === false) return null
          return (
            <div key={entry.id || idx} className="flex justify-between text-black my-0.5" style={{ fontSize: '0.95em', fontFamily: 'inherit' }}>
              <span className={entry.bold ? 'font-bold' : ''}>{vars(entry.left)}</span>
              <span className={entry.bold ? 'font-bold' : ''}>{vars(entry.right)}</span>
            </div>
          )
        }
        // Skip scan-to-pay rows — barcode block already renders "SCAN TO PAY VIA UPI" above QR
        if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) return null
        const leftStr = vars(entry.left).trim()
        const rightStr = vars(entry.right).trim()
        if (!leftStr && !rightStr) return null

        return (
          <div key={entry.id || idx} className="flex justify-between text-black my-0.5" style={{ fontSize: '0.95em', fontFamily: 'inherit' }}>
            <span className={entry.bold ? 'font-bold' : ''}>{leftStr}</span>
            {rightStr ? <span className={entry.bold ? 'font-bold' : ''}>{rightStr}</span> : null}
          </div>
        )
      }
      case 'table': {
        const showTaxColumn = resolveShowTaxColumn(entry, gstOpts?.itemWiseGst)
        const showItemNumbers = resolveShowItemNumbers(entry, gstOpts?.isRestaurant)
        return (
          <div key={entry.id || idx} className="my-1 text-black" style={{ fontFamily: 'inherit' }}>
            <div className="flex justify-between border-b border-dashed border-black pb-1 mb-1 font-bold" style={{ fontSize: '0.9em' }}>
              <span>{entry.columnHeaders?.item || 'Item'}</span>
              <span>{entry.columnHeaders?.total || 'Total'}</span>
            </div>
            {context.items.map((it, sIdx) => (
              <div key={sIdx} className="mb-1.5">
                <div className="font-bold" style={{ fontSize: '0.95em' }}>{showItemNumbers ? `${sIdx + 1}. ` : ''}{it.productName}</div>
                {showTaxColumn && it.gstRate ? (
                  <div className="text-gray-700 ml-3" style={{ fontSize: '0.85em' }}>{it.gstRate}% GST</div>
                ) : null}
                <div className="flex justify-between ml-3" style={{ fontSize: '0.9em' }}>
                  <span>{it.quantity} {it.unit || 'Pc'} x {it.unitPrice.toFixed(2)}</span>
                  <span className="font-bold">{it.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      }
      case 'multi_format':
        return (
          <div key={entry.id || idx} className="flex flex-wrap gap-1 text-black my-0.5" style={{ fontSize: '0.95em', fontFamily: 'inherit' }}>
            {(entry.segments || []).map((seg, sIdx) => (
              <span key={sIdx} className={seg.bold ? 'font-bold' : ''}>{vars(seg.text)}</span>
            ))}
          </div>
        )
      case 'files_note':
        return (
          <div key={entry.id || idx} className="my-1 text-gray-800" style={{ fontSize: '0.9em', fontFamily: 'inherit' }}>
            {entry.title ? <div className="font-bold text-black mb-0.5">{vars(entry.title)}</div> : null}
            <div className="whitespace-pre-wrap">{vars(entry.content)}</div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`mx-auto bg-white text-gray-900 rounded-t-xl shadow-lg border-t-8 border-blue-600 overflow-hidden min-w-0 ${className}`} style={{ width: '100%', maxWidth: paperMax }}>
      <div className="px-2.5 py-2 text-gray-900 overflow-x-hidden" style={fontStyle}>
        {template.entries.map(renderEntry)}
      </div>
    </div>
  )
}

/** UPI QR helper used when preview needs image URL */
export { getUpiQrImageUrl }
