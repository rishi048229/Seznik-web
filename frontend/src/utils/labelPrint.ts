import { EscPosBuilder } from './escpos'
import type { LabelElement } from '@/types/settings.types'
import { receiptLabelGapDots } from './labelSizes'

export interface LabelData {
  businessName: string
  productName: string
  price: string
  /** Barcode/QR payload — a product's barcode, falling back to its SKU. */
  barcodeValue: string
  sku?: string
  category?: string
  sequenceNo?: string
}

// Shared default layout — used both as the Label Designer's starting point
// and as the fallback template anywhere else in the app that prints a label
export const defaultLabelTemplate: LabelElement[] = [
  { id: 'el-business', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-product', type: 'productName', align: 'center', bold: false, fontSize: 'small' },
  { id: 'el-barcode', type: 'barcode', align: 'center', bold: false },
  { id: 'el-mrp-hdr', type: 'mrpHeader', align: 'center', bold: false, fontSize: 'small', prefix: 'MRP (Incl. of all taxes)' },
  { id: 'el-price', type: 'price', align: 'center', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

export const PRESET_RETAIL_DUAL_CODE: LabelElement[] = [
  { id: 'el-1', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-2', type: 'productName', align: 'left', bold: true, fontSize: 'small' },
  { id: 'el-3', type: 'sideBySideBarcodeQr', align: 'center', bold: false },
  { id: 'el-4', type: 'mrpHeader', align: 'left', bold: false, fontSize: 'small', prefix: 'MRP (Incl. of all taxes)' },
  { id: 'el-5', type: 'price', align: 'left', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

export const PRESET_CENTERED_STANDARD: LabelElement[] = [
  { id: 'el-1', type: 'businessName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-2', type: 'productName', align: 'center', bold: true, fontSize: 'medium' },
  { id: 'el-3', type: 'barcode', align: 'center', bold: false },
  { id: 'el-4', type: 'price', align: 'center', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

export const PRESET_MINIMAL_TAG: LabelElement[] = [
  { id: 'el-1', type: 'productName', align: 'left', bold: true, fontSize: 'small' },
  { id: 'el-2', type: 'barcode', align: 'center', bold: false },
  { id: 'el-3', type: 'price', align: 'right', bold: true, fontSize: 'medium', prefix: 'Rs. ' },
]

/** Sanitizes text to remove non-ASCII characters (e.g. ₹ -> Rs.) that cause Chinese mojibake on printers */
export function cleanTextForPrinter(str: string): string {
  if (!str) return ''
  return str.replace(/₹/g, 'Rs. ').replace(/[^\x00-\x7F]/g, '').trim()
}

// Currency markers that may already be baked into an upstream-formatted price
// string (e.g. formatINR() emits "₹330.00"). Stripped before a template's own
// prefix/suffix is applied so "Rs. " never gets applied on top of another
// "Rs. " / "₹" already present in the value — the cause of the duplicated
// "Rs. Rs. 330.00" bug.
// No trailing \b after "Rs\.?" on purpose: with the period included, \b would
// need a word/non-word transition right after the period, but the period
// itself is non-word and is normally followed by a space (also non-word) —
// so a trailing boundary silently fails to consume the period, leaving a
// stray "." behind (this shipped once and produced "Rs. . 1,299.00" on a
// real printer, since safeData.price already reads "Rs. 1,299.00" by the
// time this runs — cleanTextForPrinter converts ₹ to "Rs. " upstream).
const CURRENCY_MARKER_RE = /₹|\bRs\.?|\bINR\b/gi

export const resolveElementText = (el: LabelElement, data: LabelData): string => {
  const pfx = el.prefix ?? ''
  const sfx = el.suffix ?? ''
  let val = ''

  switch (el.type) {
    case 'businessName': val = data.businessName; break
    case 'productName': val = data.productName; break
    case 'price': val = data.price.replace(CURRENCY_MARKER_RE, '').trim(); break
    // No hardcoded fallback text here: every built-in template already
    // carries 'MRP (Incl. of all taxes)' as this element's `prefix`, so
    // falling back to that same string for `val` when `el.text` is unset
    // duplicated it ("MRP (Incl. of all taxes)MRP (Incl. of all taxes)").
    case 'mrpHeader': val = el.text ?? ''; break
    case 'sku': val = data.sku || data.barcodeValue; break
    case 'category': val = data.category || ''; break
    case 'sequenceNo': val = data.sequenceNo || ''; break
    case 'custom': val = el.text ?? ''; break
    case 'barcode':
    case 'qrCode':
    case 'sideBySideBarcodeQr':
    case 'divider':
      return ''
  }

  const raw = `${pfx}${val}${sfx}`
  return cleanTextForPrinter(raw)
}

/**
 * Builds compact ESC/POS bytes scaled specifically to fit inside small sticker label
 * dimensions (e.g. 50mm x 30mm) without overflowing across label gap boundaries.
 */
export function generateLabelEscPos(
  template: LabelElement[],
  barcodeType: 'CODE128' | 'EAN13' | 'QR',
  data: LabelData
): Uint8Array {
  const builder = new EscPosBuilder()
  builder.init('58mm')

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  for (const el of template) {
    builder.align(el.align || 'center')

    if (el.type === 'divider') {
      builder.line('--------------------------------')
      continue
    }

    if (el.type === 'barcode' || el.type === 'qrCode' || el.type === 'sideBySideBarcodeQr') {
      if (el.type === 'qrCode' || barcodeType === 'QR') {
        builder.qr(safeData.barcodeValue, 3)
      } else {
        builder.barcode(barcodeType, safeData.barcodeValue, 32)
      }
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    const isLarge = el.large || el.fontSize === 'large' || el.fontSize === 'xlarge'
    const isBold = el.bold ?? false

    builder.bold(isBold)
    builder.doubleSize(isLarge)
    builder.line(text)
    builder.bold(false)
    builder.doubleSize(false)
  }

  builder.feedDots(receiptLabelGapDots())
  return builder.toBytes()
}

/**
 * Calculates exact Code 128 symbol width in dots for TSPL's "128" code type
 * (automatic subset A/B/C switching — NOT "128M", which is manual switching
 * and requires explicit "!nnn" control codes we don't emit; feeding it plain
 * data with no control codes meant the printer wasn't applying Code C's
 * digit-pair compression, so real barcodes printed far wider than this
 * formula predicted and ran past the label's right edge).
 * Code 128 symbols are composed of:
 * - Start character: 11 modules
 * - Encoded data: 11 modules per character (or 11 modules per 2-digit numeric pair in Code C)
 * - Check digit: 11 modules
 * - Stop character: 13 modules
 * Total fixed symbol overhead = 11 + 11 + 13 = 35 modules.
 */
function estimateTsplCode128Dots(text: string, moduleWidth: number): number {
  let charCount = 0
  let i = 0
  while (i < text.length) {
    let digitLen = 0
    while (i + digitLen < text.length && text.charCodeAt(i + digitLen) >= 48 && text.charCodeAt(i + digitLen) <= 57) {
      digitLen++
    }
    if (digitLen >= 4) {
      const pairs = Math.floor(digitLen / 2)
      charCount += pairs
      i += pairs * 2
    } else {
      charCount++
      i++
    }
  }
  const totalModules = charCount * 11 + 35
  return totalModules * moduleWidth
}

// ---------------------------------------------------------------------------
// Proportional layout engine (TSPL)
//
// All dimensions in dots at 8 dots/mm (203 DPI). Every constant below is a
// physical minimum (legibility / scan reliability / head edge dead-zone),
// not a magic number — the whole point of this rewrite is that label height
// no longer changes the *logic*, only how much of it is used.
//
// A single planning pass (planLabelLayout) computes every element's vertical
// slot ONCE; both generateLabelTspl and preview/test tooling render from
// that same plan, so the "estimate" pass and the "actual" render pass can
// never drift apart again. That drift — a size guessed in one loop, a
// different size used when the other loop actually emitted TSPL — was the
// root cause of the top-clip and barcode/price collision bugs: a later tweak
// to one loop's spacing was not mirrored in the other.
// ---------------------------------------------------------------------------

const DOTS_PER_MM = 8
const MIN_TOP_MARGIN_DOTS = 2 * DOTS_PER_MM // 2mm — first line must never be clipped by the head top dead-zone
const MIN_BOTTOM_MARGIN_DOTS = 2 * DOTS_PER_MM // 2mm
const MIN_GAP_DOTS = 1 * DOTS_PER_MM // 1mm — minimum breathing room between any two stacked elements
const QUIET_ZONE_DOTS = 2 * DOTS_PER_MM // 2mm — required blank margin either side of a barcode
const BARCODE_MIN_HEIGHT_DOTS = 3 * DOTS_PER_MM // 3mm floor so bars stay scannable
const BARCODE_MAX_HEIGHT_DOTS = 20 * DOTS_PER_MM // 20mm — no benefit scaling taller than this
const HRI_TEXT_HEIGHT_DOTS = 3 * DOTS_PER_MM // 3mm reserved for the barcode human-readable digit row
// Total vertical footprint a 1D barcode element consumes beyond its own bar
// height: a gap before the digits, plus the digit row itself.
const BARCODE_EXTRA_DOTS = MIN_GAP_DOTS + HRI_TEXT_HEIGHT_DOTS // 32 dots (was a flat, too-tight "+22" before)
const QR_MIN_SIZE_DOTS = 6 * DOTS_PER_MM // 6mm
const QR_MAX_SIZE_DOTS = 20 * DOTS_PER_MM // 20mm

const TEXT_LINE_HEIGHT_DOTS: Record<string, number> = { small: 20, medium: 24, large: 28, xlarge: 34 }
const TEXT_CHAR_WIDTH_DOTS: Record<string, number> = { small: 8, medium: 12, large: 16, xlarge: 24 }
const TEXT_FONT_CODE: Record<string, string> = { small: '"1"', medium: '"2"', large: '"3"', xlarge: '"4"' }

function isBarcodeLike(type: LabelElement['type']): boolean {
  return type === 'barcode' || type === 'qrCode' || type === 'sideBySideBarcodeQr'
}

// Elements that may be silently dropped on very short labels (e.g. 50x15mm),
// in priority order — first in this list is dropped first. productName,
// price, and the barcode/QR itself are never dropped, per the requirement to
// "keep barcode + price + product name" when everything does not fit.
const DROPPABLE_PRIORITY: LabelElement['type'][] = ['mrpHeader', 'businessName', 'divider', 'category', 'sku', 'sequenceNo', 'custom']

function clampDots(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export interface LabelLayoutBlock {
  id: string
  type: LabelElement['type']
  /** Top Y of this element's slot, in dots from the label's top edge. */
  y: number
  /** Height of this element's slot, in dots (includes its own internal reserved space, e.g. barcode HRI row). */
  height: number
}

export interface LabelLayoutPlan {
  widthDots: number
  heightDots: number
  blocks: LabelLayoutBlock[]
  /** Element ids removed by the short-label fallback because they did not fit. */
  droppedIds: string[]
  /**
   * True when the label is so short that even product name + barcode + price
   * did not fit with a human-readable digit row under the barcode — the row
   * was suppressed (human_readable=0) to recover space rather than letting
   * the barcode collide with the price line below it. The barcode itself
   * still prints and still scans; only the printed digits under it are gone.
   */
  hriSuppressed: boolean
}

/**
 * Computes the vertical slot for every element once, applying the short-label
 * fallback (dropping least-essential elements first) if everything does not
 * fit even at minimum sizes. This is the single source of truth consumed by
 * both generateLabelTspl (to emit real TSPL) and previewLabelLayout (to
 * verify the math without a physical printer).
 */
export function planLabelLayout(
  template: LabelElement[],
  barcodeType: 'CODE128' | 'EAN13' | 'QR',
  data: LabelData,
  labelWidth: number,
  labelHeight: number
): LabelLayoutPlan {
  const widthDots = Math.max(100, Math.round(labelWidth * DOTS_PER_MM))
  const heightDots = Math.max(80, Math.round(labelHeight * DOTS_PER_MM))

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  // Elements that resolve to no visible text are never part of the layout at all.
  let elements = template.filter(el => isBarcodeLike(el.type) || !!resolveElementText(el, safeData))

  const minHeightFor = (type: LabelElement['type'], el: LabelElement, hriSuppressed: boolean): number => {
    if (type === 'divider') return 10
    if (type === 'qrCode') return QR_MIN_SIZE_DOTS
    if (type === 'sideBySideBarcodeQr') return Math.max(BARCODE_MIN_HEIGHT_DOTS + BARCODE_EXTRA_DOTS, QR_MIN_SIZE_DOTS)
    if (type === 'barcode') {
      if (barcodeType === 'QR') return QR_MIN_SIZE_DOTS
      return BARCODE_MIN_HEIGHT_DOTS + (hriSuppressed ? 0 : BARCODE_EXTRA_DOTS)
    }
    const sizeKey = el.fontSize || (el.large ? 'large' : 'medium')
    return TEXT_LINE_HEIGHT_DOTS[sizeKey] ?? TEXT_LINE_HEIGHT_DOTS.medium
  }

  const minRequiredHeight = (els: LabelElement[], hriSuppressed: boolean): number => {
    const sum = els.reduce((s, el) => s + minHeightFor(el.type, el, hriSuppressed), 0)
    const gaps = Math.max(0, els.length - 1) * MIN_GAP_DOTS
    return sum + gaps + MIN_TOP_MARGIN_DOTS + MIN_BOTTOM_MARGIN_DOTS
  }

  const droppedIds: string[] = []
  for (const dropType of DROPPABLE_PRIORITY) {
    if (minRequiredHeight(elements, false) <= heightDots) break
    const toDrop = elements.filter(el => el.type === dropType)
    if (toDrop.length === 0) continue
    droppedIds.push(...toDrop.map(el => el.id))
    elements = elements.filter(el => el.type !== dropType)
  }

  // Last resort for labels too short to fit product name + barcode (with its
  // digit row) + price even after every optional element is gone: drop just
  // the barcode's human-readable digit row. The barcode itself keeps
  // printing and keeps scanning — only the printed digits under it go.
  const hriSuppressed = minRequiredHeight(elements, false) > heightDots && minRequiredHeight(elements, true) <= heightDots

  // Fixed-size blocks (everything except the single barcode/QR element, whose
  // height is variable — it absorbs whatever vertical space is left over).
  const fixedBlocks: { el: LabelElement; height: number }[] = []
  let barcodeEl: LabelElement | null = null
  for (const el of elements) {
    if (isBarcodeLike(el.type)) {
      barcodeEl = el // at most one per template in practice; last one wins if a custom template has more
      continue
    }
    fixedBlocks.push({ el, height: el.type === 'divider' ? 10 : minHeightFor(el.type, el, hriSuppressed) })
  }

  const fixedTotal = fixedBlocks.reduce((s, b) => s + b.height, 0)
  const elementCount = fixedBlocks.length + (barcodeEl ? 1 : 0)
  const gapsTotal = Math.max(0, elementCount - 1) * MIN_GAP_DOTS
  const availableForBarcode = heightDots - MIN_TOP_MARGIN_DOTS - MIN_BOTTOM_MARGIN_DOTS - fixedTotal - gapsTotal
  const barcodeExtra = hriSuppressed ? 0 : BARCODE_EXTRA_DOTS

  let barcodeSlotHeight = 0
  if (barcodeEl) {
    const isQr = barcodeEl.type === 'qrCode' || (barcodeEl.type === 'barcode' && barcodeType === 'QR')
    if (barcodeEl.type === 'sideBySideBarcodeQr') {
      // Kept compact/fixed — this preset packs a 1D code and a QR side by
      // side rather than stacked, and was not part of the reported bugs.
      barcodeSlotHeight = 56
    } else if (isQr) {
      barcodeSlotHeight = clampDots(availableForBarcode, QR_MIN_SIZE_DOTS, QR_MAX_SIZE_DOTS)
    } else {
      const barHeight = clampDots(availableForBarcode - barcodeExtra, BARCODE_MIN_HEIGHT_DOTS, BARCODE_MAX_HEIGHT_DOTS)
      barcodeSlotHeight = barHeight + barcodeExtra
    }
  }

  const usedHeight = fixedTotal + gapsTotal + (barcodeEl ? barcodeSlotHeight : 0) + MIN_TOP_MARGIN_DOTS + MIN_BOTTOM_MARGIN_DOTS
  const leftover = Math.max(0, heightDots - usedHeight)
  // No barcode to soak up slack (a pure text label, or the barcode already
  // hit its max-height cap): spread the remainder as extra top/bottom margin
  // so short templates still look centered instead of pinned to the top.
  const extraTopMargin = Math.floor(leftover / 2)

  const blocks: LabelLayoutBlock[] = []
  let y = MIN_TOP_MARGIN_DOTS + extraTopMargin
  for (const el of elements) {
    const height = isBarcodeLike(el.type) ? barcodeSlotHeight : (fixedBlocks.find(b => b.el === el)?.height ?? 0)
    blocks.push({ id: el.id, type: el.type, y, height })
    y += height + MIN_GAP_DOTS
  }

  return { widthDots, heightDots, blocks, droppedIds, hriSuppressed }
}

/**
 * Renders a layout plan block-by-block as a plain-text table — used to
 * verify the position math for a given label size without a physical printer.
 */
export function formatLayoutPlan(plan: LabelLayoutPlan, template: LabelElement[]): string {
  const lines = [`Label: ${plan.widthDots}x${plan.heightDots} dots (${(plan.widthDots / DOTS_PER_MM).toFixed(1)}x${(plan.heightDots / DOTS_PER_MM).toFixed(1)}mm)`]
  for (const b of plan.blocks) {
    lines.push(`  ${b.type.padEnd(20)} y=${String(b.y).padStart(4)}  h=${String(b.height).padStart(4)}  bottom=${b.y + b.height}`)
  }
  if (plan.droppedIds.length) {
    const dropped = template.filter(el => plan.droppedIds.includes(el.id)).map(el => el.type)
    lines.push(`  dropped (did not fit): ${dropped.join(', ')}`)
  }
  if (plan.hriSuppressed) {
    lines.push(`  barcode human-readable digit row suppressed (label too short to fit it without overlap)`)
  }
  return lines.join('\n')
}

/**
 * Builds TSPL / TSPL2 command bytes for dedicated dual-mode label printers.
 * Automatically computes exact dead-center coordinates (both X and Y) and
 * proportional spacing for any label dimensions (50x30mm, 50x25mm, 60x40mm, etc.).
 */
export function generateLabelTspl(
  template: LabelElement[],
  barcodeType: 'CODE128' | 'EAN13' | 'QR',
  data: LabelData,
  labelWidth = 50,
  labelHeight = 30,
  offsetX = 0,
  offsetY = 0,
  barcodeHeight = 30,
  direction: 0 | 1 = 0,
  barcodeCenterOffsetMm = 0
): Uint8Array {
  const encoder = new TextEncoder()
  const offsetXDots = Math.round((offsetX || 0) * DOTS_PER_MM)
  const offsetYDots = Math.round((offsetY || 0) * DOTS_PER_MM)
  const barcodeNudgeDots = Math.round((barcodeCenterOffsetMm || 0) * DOTS_PER_MM)
  void barcodeHeight // superseded by the plan's proportional barcode sizing (see planLabelLayout); kept for call-site compatibility

  const plan = planLabelLayout(template, barcodeType, data, labelWidth, labelHeight)
  const { widthDots, heightDots, blocks } = plan
  const blockById = new Map(blocks.map(b => [b.id, b]))
  void heightDots

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  let tspl = `SIZE ${labelWidth} mm, ${labelHeight} mm\r\n`
  tspl += `GAP 2 mm, 0 mm\r\n`
  tspl += `DIRECTION ${direction}\r\n`
  tspl += `CLS\r\n`

  // Clamps a barcode's X so it always keeps its quiet zone, even if a user
  // calibration nudge (barcodeCenterOffsetMm) would otherwise push it past
  // the label edge. Falls back to best-effort centering only if the barcode
  // itself is wider than the label can support with any quiet zone at all.
  const clampBarcodeX = (rawX: number, barcodeWidthDots: number): number => {
    const minX = QUIET_ZONE_DOTS
    const maxX = widthDots - barcodeWidthDots - QUIET_ZONE_DOTS
    if (maxX < minX) return Math.max(0, Math.round((widthDots - barcodeWidthDots) / 2))
    return clampDots(rawX, minX, maxX)
  }

  for (const el of template) {
    const block = blockById.get(el.id)
    if (!block) continue // dropped by the short-label fallback
    const align = el.align || 'center'
    const y = block.y + offsetYDots

    if (el.type === 'divider') {
      const startX = Math.max(5, 15 + offsetXDots)
      const lineLen = Math.max(20, widthDots - 30)
      tspl += `BAR ${startX},${y},${lineLen},2\r\n`
      continue
    }

    if (el.type === 'sideBySideBarcodeQr') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      const leftHalfDots = Math.floor(widthDots * 0.62)
      const rightHalfDots = widthDots - leftHalfDots

      const moduleWidth = 2
      const barWidthDots = estimateTsplCode128Dots(barcodeStr, moduleWidth)
      const xBar = clampBarcodeX(Math.floor((leftHalfDots - barWidthDots) / 2) + offsetXDots + barcodeNudgeDots, barWidthDots)

      const qrSizeDots = 64 // ~8mm QR size
      const xQr = Math.max(leftHalfDots, leftHalfDots + Math.floor((rightHalfDots - qrSizeDots) / 2) + offsetXDots)

      tspl += `BARCODE ${xBar},${y},"128",28,2,0,${moduleWidth},${moduleWidth * 2},"${barcodeStr}"\r\n`
      tspl += `QRCODE ${xQr},${y},L,3,A,0,"${barcodeStr}"\r\n`
      continue
    }

    if (el.type === 'barcode' || el.type === 'qrCode') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      if (el.type === 'qrCode' || barcodeType === 'QR') {
        const qrSizeDots = block.height
        const x = align === 'left'
          ? Math.max(QUIET_ZONE_DOTS, QUIET_ZONE_DOTS + offsetXDots)
          : align === 'right'
          ? Math.max(QUIET_ZONE_DOTS, widthDots - qrSizeDots - QUIET_ZONE_DOTS + offsetXDots)
          : Math.max(QUIET_ZONE_DOTS, Math.round((widthDots - qrSizeDots) / 2) + offsetXDots)
        const cell = Math.max(2, Math.min(6, Math.round(qrSizeDots / 24)))
        tspl += `QRCODE ${x},${y},L,${cell},A,0,"${barcodeStr}"\r\n`
      } else {
        const barcodeExtra = plan.hriSuppressed ? 0 : BARCODE_EXTRA_DOTS
        const barHeight = Math.max(BARCODE_MIN_HEIGHT_DOTS, block.height - barcodeExtra)
        const maxPrintableWidth = Math.max(60, widthDots - 2 * QUIET_ZONE_DOTS)
        const rawWidthAt2 = estimateTsplCode128Dots(barcodeStr, 2)
        const moduleWidth = rawWidthAt2 > maxPrintableWidth ? 1 : 2
        const barcodeWidthDots = estimateTsplCode128Dots(barcodeStr, moduleWidth)
        const wideRatio = moduleWidth * 2

        const rawX = align === 'left'
          ? QUIET_ZONE_DOTS + offsetXDots
          : align === 'right'
          ? widthDots - barcodeWidthDots - QUIET_ZONE_DOTS + offsetXDots
          : Math.round((widthDots - barcodeWidthDots) / 2) + offsetXDots
        const x = clampBarcodeX(rawX + barcodeNudgeDots, barcodeWidthDots)

        // TSPL BARCODE x, y, "128" (auto subset switching, so Code C's
        // digit-pair compression actually applies and matches the width this
        // module estimates — "128M" needs manual "!nnn" control codes we
        // don't send, so it silently skipped that compression on real
        // hardware and printed noticeably wider than expected), height,
        // human_readable (2 = centered below, 0 = suppressed on labels too
        // short to fit the digit row without overlapping the element below
        // it), rotation, narrow, wide, "data"
        const humanReadable = plan.hriSuppressed ? 0 : 2
        tspl += `BARCODE ${x},${y},"128",${Math.round(barHeight)},${humanReadable},0,${moduleWidth},${wideRatio},"${barcodeStr}"\r\n`
      }
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    const sizeKey = el.fontSize || (el.large ? 'large' : 'medium')
    const font = TEXT_FONT_CODE[sizeKey] ?? TEXT_FONT_CODE.medium
    const charWidth = TEXT_CHAR_WIDTH_DOTS[sizeKey] ?? TEXT_CHAR_WIDTH_DOTS.medium
    const mulX = 1
    const mulY = 1

    const textWidthDots = text.length * charWidth * mulX
    const x = align === 'left'
      ? Math.max(5, 15 + offsetXDots)
      : align === 'right'
      ? Math.max(5, widthDots - textWidthDots - 15 + offsetXDots)
      : Math.max(5, Math.round((widthDots - textWidthDots) / 2) + offsetXDots)

    const safeText = text.replace(/"/g, '').replace(/[\r\n]+/g, ' ')
    tspl += `TEXT ${x},${y},${font},0,${mulX},${mulY},"${safeText}"\r\n`
  }

  tspl += `PRINT 1,1\r\n`
  return encoder.encode(tspl)
}

/**
 * Generates TSPL Gap Auto-Calibration command bytes to calibrate
 * physical sticker gap sensors on dual-mode label printers.
 */
export function generateGapCalibrationBytes(): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode('GAPDETECT\r\nAUTO GAP\r\n')
}
