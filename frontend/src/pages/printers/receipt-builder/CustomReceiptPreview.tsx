import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ImageIcon } from 'lucide-react'
import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import {
  compactTableNameWidth,
  compileGstBreakdownPairs,
  interpolateReceiptVariables,
  resolveCompactTableWrap,
  resolveShowItemNumbers,
  resolveShowTaxColumn,
  wrapCompactTableName,
  type CustomReceiptGstOpts,
  type ReceiptPrintContext,
} from '@/utils/customReceiptEngine'
import { getCols } from '@/utils/receiptEngine'
import { buildUpiPayLink, getUpiQrImageUrl, isValidUpiVpa } from '@/utils/upiQr'
import { getReceiptPreviewFontStyle, getReceiptPreviewMaxWidth } from './receiptPreviewStyles'
import { isReceiptEntryEnabled, resolveReceiptImageSrc } from '@/utils/receiptLogo'
import { receiptQrPreviewPx, receiptStandardQrHtmlPxFromChip, wrapReceiptWords } from '@shared/receiptPrintGeometry'

interface CustomReceiptPreviewProps {
  template: CustomReceiptTemplate
  context: ReceiptPrintContext
  gstOpts?: CustomReceiptGstOpts
  className?: string
  paperWidth?: '58mm' | '80mm'
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
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set())
  const activeSrc = (src && !failedSrcs.has(src)) ? src : (fallbackSrc && !failedSrcs.has(fallbackSrc)) ? fallbackSrc : undefined
  const w = `${Math.min(widthPercent, 100)}%`

  if (!activeSrc) {
    return null
  }

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt="Logo"
      className="object-contain max-h-16 min-h-8"
      style={{ width: w, maxWidth: '100%', filter: 'grayscale(100%) contrast(250%)' }}
      onError={() => {
        if (activeSrc) {
          setFailedSrcs((prev) => new Set(prev).add(activeSrc))
        }
      }}
    />
  )
}

export function CustomReceiptPreview({
  template,
  context,
  gstOpts,
  className = '',
  paperWidth: propPaperWidth,
}: CustomReceiptPreviewProps) {
  const paperWidth = propPaperWidth || template.paperWidth || '58mm'
  const paperMax = getReceiptPreviewMaxWidth(paperWidth)
  const cols = getCols(paperWidth, undefined, gstOpts?.receiptFont)
  const fontStyle = getReceiptPreviewFontStyle(paperWidth, gstOpts?.receiptFont)
  const logoUrl = context.storeLogoUrl
  const enabledEntries = template.entries.filter(isReceiptEntryEnabled)
  const hasEnabledImageBlock = enabledEntries.some((e) => e.type === 'image')
  const wrapCompactNames = resolveCompactTableWrap(gstOpts, template)

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
        const isDouble = entry.type === 'text_special' || entry.size === 'large'
        const effectiveCols = isDouble ? Math.floor(cols / 2) : cols
        const wrappedLines = wrapReceiptWords(rawText, effectiveCols)
        if (!wrappedLines.length) return null
        return (
          <div
            key={entry.id || idx}
            className={`text-black ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
            style={{
              fontSize: size,
              fontWeight: entry.bold ? 700 : 500,
              fontFamily: 'inherit',
              overflowWrap: 'break-word',
              wordBreak: 'normal',
              lineHeight: 1.35,
            }}
          >
            {wrappedLines.map((line, lIdx) => (
              <div key={lIdx}>{line || '\u00A0'}</div>
            ))}
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
        } else if (entry.qrType === 'custom') {
          rawVal = rawVal && rawVal !== '{{custom_url}}' ? rawVal : 'https://seznik.com'
        } else if (entry.qrType === 'digital_bill' || !rawVal || rawVal === '{{bill_pdf_url}}') {
          const targetId = encodeURIComponent(context.saleId || context.invoiceNumber || 'INV-2026-0042')
          rawVal = typeof window !== 'undefined'
            ? `${window.location.origin}/receipt/${targetId}`
            : `https://api.seznik.com/receipt/${targetId}`
        } else if (entry.qrType === 'invoice_barcode' || rawVal === '{{invoice_no}}') {
          rawVal = context.invoiceNumber || 'INV-2026-0042'
        }

        const isQr =
          entry.codeType === 'qr_code' ||
          entry.format === 'qr' ||
          entry.qrType === 'upi' ||
          entry.qrType === 'digital_bill' ||
          entry.qrType === 'custom' ||
          Boolean(entry.upiId) ||
          Boolean(entry.value?.includes('{{upi_qr}}')) ||
          Boolean(entry.value?.includes('{{bill_pdf_url}}')) ||
          rawVal.startsWith('http://') ||
          rawVal.startsWith('https://') ||
          rawVal.startsWith('upi://')

        const isUpi = entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || Boolean(entry.upiId)
        const qrSize =
          isUpi || entry.qrType === 'digital_bill' || !entry.size
            ? receiptStandardQrHtmlPxFromChip(gstOpts?.receiptQrSize)
            : receiptQrPreviewPx(entry.size === 'large' || entry.size === 'small' ? entry.size : 'medium')

        return (
          <div key={entry.id || idx} className={`my-2 flex ${entry.align === 'left' ? 'justify-start' : entry.align === 'right' ? 'justify-end' : 'justify-center'}`}>
            {isQr ? (
              <div className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 inline-block">
                <QRCodeSVG
                  value={rawVal || 'https://seznik.com'}
                  size={qrSize}
                  level="M"
                  includeMargin={true}
                />
              </div>
            ) : (entry.format === 'code128' || entry.format === 'ean13' || entry.codeType === 'barcode_1d') ? (
              <span className="font-mono text-xs">*{rawVal}*</span>
            ) : null}
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
        if (entry.tableType === 'advanced') {
          const itemCol = entry.columnHeaders?.item || 'ITEM'
          const qtyCol = entry.columnHeaders?.qty || 'QTY'
          const totalCol = entry.columnHeaders?.total || 'AMT'
          const nameWidth = compactTableNameWidth(cols)
          return (
            <div key={entry.id || idx} className="my-1 text-black" style={{ fontFamily: 'inherit' }}>
              <div className="flex justify-between border-b border-dashed border-black pb-1 mb-1 font-bold" style={{ fontSize: '0.85em' }}>
                <span className="flex-1">{itemCol}</span>
                <span className="w-7 text-right">{qtyCol}</span>
                <span className="w-12 text-right">{totalCol}</span>
              </div>
              {context.items.map((it, sIdx) => {
                const name = it.productName.toUpperCase()
                const qtyLabel = Number.isInteger(it.quantity) ? String(it.quantity) : it.quantity.toFixed(3)
                const amountLabel = it.total.toFixed(2)
                if (!wrapCompactNames || name.length <= nameWidth) {
                  return (
                    <div key={sIdx} className="flex justify-between mb-0.5" style={{ fontSize: '0.85em' }}>
                      <span className={`flex-1 font-bold ${!wrapCompactNames ? 'truncate' : ''}`}>{name}</span>
                      <span className="w-7 text-right shrink-0">{qtyLabel}</span>
                      <span className="w-12 text-right font-bold shrink-0">{amountLabel}</span>
                    </div>
                  )
                }
                const nameLines = wrapCompactTableName(name, nameWidth)
                return (
                  <div key={sIdx} className="mb-2" style={{ fontSize: '0.85em' }}>
                    <div className="flex justify-between items-start">
                      <span className="flex-1 font-bold leading-tight">{nameLines[0]}</span>
                      <span className="w-7 text-right shrink-0 leading-tight">{qtyLabel}</span>
                      <span className="w-12 text-right font-bold shrink-0 leading-tight">{amountLabel}</span>
                    </div>
                    {nameLines.slice(1).map((line, lineIdx) => (
                      <div key={lineIdx} className="font-bold leading-tight">{line.trimEnd()}</div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        }
        return (
          <div key={entry.id || idx} className="my-1 text-black" style={{ fontFamily: 'inherit' }}>
            <div className="flex justify-between border-b border-dashed border-black pb-1 mb-1 font-bold" style={{ fontSize: '0.9em' }}>
              <span>{entry.columnHeaders?.item || 'Item'}</span>
              <span>{entry.columnHeaders?.total || 'Total'}</span>
            </div>
            {context.items.map((it, sIdx) => {
              const fullName = `${showItemNumbers ? `${sIdx + 1}. ` : ''}${it.productName}`
              const nameLines = wrapReceiptWords(fullName, cols)
              return (
                <div key={sIdx} className="mb-1.5">
                  <div className="font-bold leading-tight" style={{ fontSize: '0.95em' }}>
                    {nameLines.map((line, nIdx) => (
                      <div key={nIdx}>{line}</div>
                    ))}
                  </div>
                  {showTaxColumn && it.gstRate ? (
                    <div className="text-gray-700 ml-3" style={{ fontSize: '0.85em' }}>{it.gstRate}% GST</div>
                  ) : null}
                  <div className="flex justify-between ml-3" style={{ fontSize: '0.9em' }}>
                    <span>{it.quantity} {it.unit || 'Pc'} x {it.unitPrice.toFixed(2)}</span>
                    <span className="font-bold">{it.total.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
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
