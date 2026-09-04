import { EscPosBuilder } from './escpos'
import type { LabelElement } from '@/types/settings.types'
import type { LabelRotation } from './labelSizes'
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
  data: LabelData,
  options?: { rotation?: LabelRotation; labelWidth?: number; labelHeight?: number }
): Uint8Array {
  const rotation = options?.rotation ?? 0
  const labelWidth = options?.labelWidth ?? 50
  const labelHeight = options?.labelHeight ?? 30

  const builder = new EscPosBuilder()
  builder.init('58mm')

  const pageRotate = rotation === 90 || rotation === 270
  if (pageRotate) {
    builder.beginPageMode(
      Math.max(200, Math.round(labelWidth * 8)),
      Math.max(80, Math.round(labelHeight * 8)),
      rotation,
    )
  } else if (rotation === 180) {
    builder.upsideDown(true)
  }

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
      const printQr = el.type === 'qrCode' || barcodeType === 'QR' || el.type === 'sideBySideBarcodeQr'
      const printBars = el.type !== 'qrCode' && barcodeType !== 'QR'
      if (printBars) {
        builder.barcode(barcodeType === 'EAN13' ? 'EAN13' : 'CODE128', safeData.barcodeValue, pageRotate ? 28 : 32)
      }
      if (printQr) {
        builder.qr(safeData.barcodeValue, pageRotate ? 2 : 3)
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

  if (pageRotate) {
    builder.printPageMode()
  } else if (rotation === 180) {
    builder.upsideDown(false)
  }

  // Continuous receipt paper has no sticker gap sensor — feed a blank strip
  // so the next label does not print flush against this one.
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
  let inCodeC = false
  while (i < text.length) {
    let digitLen = 0
    while (i + digitLen < text.length && text.charCodeAt(i + digitLen) >= 48 && text.charCodeAt(i + digitLen) <= 57) {
      digitLen++
    }
    if (digitLen >= 4) {
      if (!inCodeC) {
        charCount++ // Code B → C latch
        inCodeC = true
      }
      const pairs = Math.floor(digitLen / 2)
      charCount += pairs
      i += pairs * 2
    } else {
      if (inCodeC) {
        charCount++ // Code C → B latch
        inCodeC = false
      }
      charCount++
      i++
    }
  }
  const totalModules = charCount * 11 + 35
  return totalModules * moduleWidth
}

/** QR version modules for typical product barcode/SKU payloads. */
function qrModulesFor(data: string): number {
  if (data.length <= 20) return 21
  if (data.length <= 38) return 25
  return 29
}

function qrSizeDots(data: string, cell: number): number {
  return qrModulesFor(data) * cell
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
/** Dual barcode+QR: barcode bars match the standard label (~7mm), QR ~8mm. */
const DUAL_QR_CELL = 3
const DUAL_QR_SIZE_DOTS = 70
const DUAL_BAR_HEIGHT_DOTS = 56
const DUAL_ROW_HEIGHT_DOTS = DUAL_BAR_HEIGHT_DOTS + BARCODE_EXTRA_DOTS

const TEXT_LINE_HEIGHT_DOTS: Record<string, number> = { small: 16, medium: 24, large: 28, xlarge: 36 }
const TEXT_CHAR_WIDTH_DOTS: Record<string, number> = { small: 8, medium: 12, large: 16, xlarge: 24 }
const TEXT_FONT_CODE: Record<string, string> = { small: '"1"', medium: '"2"', large: '"3"', xlarge: '"4"' }
const TEXT_GLYPH_HEIGHT_DOTS: Record<string, number> = { small: 12, medium: 20, large: 24, xlarge: 32 }
const TEXT_SIDE_MARGIN_DOTS = 20

function isBarcodeLike(type: LabelElement['type']): boolean {
  return type === 'barcode' || type === 'qrCode' || type === 'sideBySideBarcodeQr'
}

function dualCodeFitsSideBySide(widthDots: number, barcodeStr: string): boolean {
  const barW = estimateTsplCode128Dots(barcodeStr, 1)
  const qrS = qrSizeDots(barcodeStr, 2)
  return barW + qrS + MIN_GAP_DOTS + 2 * QUIET_ZONE_DOTS <= widthDots
}

function alignX(
  align: 'left' | 'center' | 'right',
  containerDots: number,
  itemDots: number,
  offsetDots = 0,
  margin = TEXT_SIDE_MARGIN_DOTS,
): number {
  if (align === 'left') return margin + offsetDots
  if (align === 'right') return Math.max(margin, containerDots - itemDots - margin + offsetDots)
  return Math.max(margin, Math.round((containerDots - itemDots) / 2) + offsetDots)
}

/**
 * Maps an unrotated content-space rectangle onto the physical sticker.
 * 90/270 content is planned in swapped W×H so a 30×50 layout fills a 50×30
 * sticker after rotation — no shrinking, so barcodes and QR stay scannable.
 */
export function contentRectToPhysical(
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  rotation: LabelRotation,
  physW: number,
  physH: number,
): { x: number; y: number; w: number; h: number } {
  if (rotation === 0 || rotation === 180) {
    return { x: cx, y: cy, w: cw, h: ch }
  }
  if (rotation === 90) {
    return { x: physW - cy - ch, y: cx, w: ch, h: cw }
  }
  return { x: cy, y: physH - cx - cw, w: ch, h: cw }
}

/**
 * TSPL TEXT/BARCODE origin for a content-space box. TSPL rotates clockwise
 * around (x,y); this returns the origin that keeps the visual box in place.
 * 180° is handled by TSPL DIRECTION, so the origin stays unrotated.
 */
export function tsplCommandOrigin(
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  rotation: LabelRotation,
  physW: number,
  physH: number,
): { x: number; y: number; rot: 0 | 90 | 270 } {
  if (rotation === 0 || rotation === 180) {
    return { x: Math.round(cx), y: Math.round(cy), rot: 0 }
  }
  if (rotation === 90) {
    return { x: Math.round(physW - cy), y: Math.round(cx), rot: 90 }
  }
  void cw
  void ch
  return { x: Math.round(cy), y: Math.round(physH - cx), rot: 270 }
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
  physicalWidthDots: number
  physicalHeightDots: number
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
  /** Dual barcode+QR stacked because the content width is too narrow for a row. */
  dualStacked: boolean
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
  labelHeight: number,
  rotation: LabelRotation = 0,
): LabelLayoutPlan {
  const swapped = rotation === 90 || rotation === 270
  const contentWmm = swapped ? labelHeight : labelWidth
  const contentHmm = swapped ? labelWidth : labelHeight
  const widthDots = Math.max(100, Math.round(contentWmm * DOTS_PER_MM))
  const heightDots = Math.max(80, Math.round(contentHmm * DOTS_PER_MM))
  const physicalWidthDots = Math.max(100, Math.round(labelWidth * DOTS_PER_MM))
  const physicalHeightDots = Math.max(80, Math.round(labelHeight * DOTS_PER_MM))

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
    if (type === 'sideBySideBarcodeQr') {
      if (rotation === 90 || rotation === 270 || !dualCodeFitsSideBySide(widthDots, safeData.barcodeValue)) {
        return DUAL_BAR_HEIGHT_DOTS + BARCODE_EXTRA_DOTS + MIN_GAP_DOTS + DUAL_QR_SIZE_DOTS
      }
      return DUAL_ROW_HEIGHT_DOTS
    }
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

  const dualStacked = !!(
    barcodeEl
    && barcodeEl.type === 'sideBySideBarcodeQr'
    && (rotation === 90 || rotation === 270 || !dualCodeFitsSideBySide(widthDots, safeData.barcodeValue))
  )

  let barcodeSlotHeight = 0
  if (barcodeEl) {
    const isQr = barcodeEl.type === 'qrCode' || (barcodeEl.type === 'barcode' && barcodeType === 'QR')
    if (barcodeEl.type === 'sideBySideBarcodeQr') {
      const compact = dualStacked
        ? DUAL_BAR_HEIGHT_DOTS + BARCODE_EXTRA_DOTS + MIN_GAP_DOTS + DUAL_QR_SIZE_DOTS
        : DUAL_ROW_HEIGHT_DOTS
      barcodeSlotHeight = Math.min(compact, Math.max(0, availableForBarcode))
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

  return { widthDots, heightDots, physicalWidthDots, physicalHeightDots, blocks, droppedIds, hriSuppressed, dualStacked }
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

function layoutDualGraphics(
  widthDots: number,
  slotY: number,
  slotH: number,
  barcodeStr: string,
  stacked: boolean,
  hriSuppressed: boolean,
  offsetXDots: number,
  barcodeNudgeDots: number,
  clampBarcodeX: (rawX: number, width: number) => number,
): {
  barcode: { x: number; y: number; width: number; barHeight: number; moduleWidth: number; humanReadable: 0 | 2 }
  qr: { x: number; y: number; size: number; cell: number }
} {
  const extra = hriSuppressed ? 0 : BARCODE_EXTRA_DOTS
  const humanReadable: 0 | 2 = hriSuppressed ? 0 : 2
  const gap = MIN_GAP_DOTS
  const maxPrintable = Math.max(60, widthDots - 2 * QUIET_ZONE_DOTS)
  const pickModule = (limit: number) => (estimateTsplCode128Dots(barcodeStr, 2) <= limit ? 2 : 1)

  if (!stacked) {
    const leftHalfDots = Math.floor(widthDots * 0.62)
    const rightHalfDots = widthDots - leftHalfDots
    const moduleWidth = estimateTsplCode128Dots(barcodeStr, 2) > leftHalfDots - 10 ? 1 : 2
    const barW = estimateTsplCode128Dots(barcodeStr, moduleWidth)
    const xBar = clampBarcodeX(Math.floor((leftHalfDots - barW) / 2) + offsetXDots + barcodeNudgeDots, barW)
    const cell = DUAL_QR_CELL
    const qrS = DUAL_QR_SIZE_DOTS
    const xQr = Math.max(leftHalfDots, leftHalfDots + Math.floor((rightHalfDots - qrS) / 2) + offsetXDots)
    return {
      barcode: {
        x: xBar,
        y: slotY,
        width: barW,
        barHeight: DUAL_BAR_HEIGHT_DOTS,
        moduleWidth,
        humanReadable,
      },
      qr: {
        x: xQr,
        y: slotY,
        size: qrS,
        cell,
      },
    }
  }

  const moduleWidth = pickModule(maxPrintable)
  const barW = estimateTsplCode128Dots(barcodeStr, moduleWidth)
  const qrS = DUAL_QR_SIZE_DOTS
  const cell = DUAL_QR_CELL
  const barH = DUAL_BAR_HEIGHT_DOTS
  const barcodeBlockH = barH + extra
  const totalH = barcodeBlockH + gap + qrS
  const y0 = slotY + Math.max(0, Math.floor((slotH - totalH) / 2))
  return {
    barcode: {
      x: clampBarcodeX(Math.round((widthDots - barW) / 2) + offsetXDots + barcodeNudgeDots, barW),
      y: y0,
      width: barW,
      barHeight: barH,
      moduleWidth,
      humanReadable,
    },
    qr: {
      x: Math.round((widthDots - qrS) / 2) + offsetXDots,
      y: y0 + barcodeBlockH + gap,
      size: qrS,
      cell,
    },
  }
}

/**
 * Builds TSPL / TSPL2 command bytes for dedicated dual-mode label printers.
 * 90° / 270° reflow into the swapped sticker box so barcode + QR stay on-label.
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
  barcodeCenterOffsetMm = 0,
  rotation: LabelRotation = 0
): Uint8Array {
  const encoder = new TextEncoder()
  const offsetXDots = Math.round((offsetX || 0) * DOTS_PER_MM)
  const offsetYDots = Math.round((offsetY || 0) * DOTS_PER_MM)
  const barcodeNudgeDots = Math.round((barcodeCenterOffsetMm || 0) * DOTS_PER_MM)
  void barcodeHeight

  const pageDirection: 0 | 1 = ((direction ? 1 : 0) ^ (rotation === 180 ? 1 : 0)) as 0 | 1
  const elementRot: LabelRotation = rotation === 180 ? 0 : rotation

  const plan = planLabelLayout(template, barcodeType, data, labelWidth, labelHeight, rotation)
  const { widthDots, physicalWidthDots: physW, physicalHeightDots: physH, blocks, dualStacked } = plan
  const blockById = new Map(blocks.map(b => [b.id, b]))

  const safeData: LabelData = {
    businessName: cleanTextForPrinter(data.businessName),
    productName: cleanTextForPrinter(data.productName),
    price: cleanTextForPrinter(data.price),
    barcodeValue: cleanTextForPrinter(data.barcodeValue || '0000000000'),
    sku: cleanTextForPrinter(data.sku || ''),
    category: cleanTextForPrinter(data.category || ''),
  }

  let tspl = `SIZE ${labelWidth} mm, ${labelHeight} mm\r\n`
  tspl += `GAP 3 mm, 0 mm\r\n`
  tspl += `DIRECTION ${pageDirection}\r\n`
  tspl += `CLS\r\n`

  const clampBarcodeX = (rawX: number, barcodeWidthDots: number): number => {
    const minX = QUIET_ZONE_DOTS
    const maxX = widthDots - barcodeWidthDots - QUIET_ZONE_DOTS
    if (maxX < minX) return Math.max(0, Math.round((widthDots - barcodeWidthDots) / 2))
    return clampDots(rawX, minX, maxX)
  }

  const place = (cx: number, cy: number, cw: number, ch: number) => {
    const p = tsplCommandOrigin(cx, cy, cw, ch, elementRot, physW, physH)
    return {
      x: clampDots(p.x, 0, physW),
      y: clampDots(p.y, 0, physH),
      rot: p.rot,
    }
  }

  const emitQr = (cx: number, cy: number, size: number, cell: number, payload: string) => {
    const vis = contentRectToPhysical(cx, cy, size, size, elementRot, physW, physH)
    const x = clampDots(Math.round(vis.x), 0, Math.max(0, physW - size))
    const y = clampDots(Math.round(vis.y), 0, Math.max(0, physH - size))
    tspl += `QRCODE ${x},${y},L,${cell},A,0,"${payload}"\r\n`
  }

  for (const el of template) {
    const block = blockById.get(el.id)
    if (!block) continue
    const align = el.align || 'center'
    const y = block.y + offsetYDots

    if (el.type === 'divider') {
      const startX = TEXT_SIDE_MARGIN_DOTS + offsetXDots
      const lineLen = Math.max(20, widthDots - TEXT_SIDE_MARGIN_DOTS * 2)
      const vis = contentRectToPhysical(startX, y, lineLen, 2, elementRot, physW, physH)
      tspl += `BAR ${Math.round(vis.x)},${Math.round(vis.y)},${Math.max(2, Math.round(vis.w))},${Math.max(2, Math.round(vis.h))}\r\n`
      continue
    }

    if (el.type === 'sideBySideBarcodeQr') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      const dual = layoutDualGraphics(
        widthDots,
        y,
        block.height,
        barcodeStr,
        dualStacked,
        plan.hriSuppressed,
        offsetXDots,
        barcodeNudgeDots,
        clampBarcodeX,
      )
      const bar = place(dual.barcode.x, dual.barcode.y, dual.barcode.width, dual.barcode.barHeight)
      tspl += `BARCODE ${bar.x},${bar.y},"128",${Math.round(dual.barcode.barHeight)},${dual.barcode.humanReadable},${bar.rot},${dual.barcode.moduleWidth},${dual.barcode.moduleWidth * 2},"${barcodeStr}"\r\n`
      emitQr(dual.qr.x, dual.qr.y, dual.qr.size, dual.qr.cell, barcodeStr)
      continue
    }

    if (el.type === 'barcode' || el.type === 'qrCode') {
      const barcodeStr = safeData.barcodeValue || '0000000000'
      if (el.type === 'qrCode' || barcodeType === 'QR') {
        const cell = Math.max(2, Math.min(6, Math.round(block.height / qrModulesFor(barcodeStr))))
        const size = qrSizeDots(barcodeStr, cell)
        const x = alignX(align, widthDots, size, offsetXDots, QUIET_ZONE_DOTS)
        const yQr = y + Math.max(0, Math.floor((block.height - size) / 2))
        emitQr(x, yQr, size, cell, barcodeStr)
      } else {
        const barcodeExtra = plan.hriSuppressed ? 0 : BARCODE_EXTRA_DOTS
        const barHeight = Math.max(BARCODE_MIN_HEIGHT_DOTS, block.height - barcodeExtra)
        const maxPrintableWidth = Math.max(60, widthDots - 2 * QUIET_ZONE_DOTS)
        const moduleWidth = estimateTsplCode128Dots(barcodeStr, 2) > maxPrintableWidth ? 1 : 2
        const barcodeWidthDots = estimateTsplCode128Dots(barcodeStr, moduleWidth)
        const x = clampBarcodeX(alignX(align, widthDots, barcodeWidthDots, offsetXDots, QUIET_ZONE_DOTS) + barcodeNudgeDots, barcodeWidthDots)
        const humanReadable = plan.hriSuppressed ? 0 : 2
        const p = place(x, y, barcodeWidthDots, barHeight)
        tspl += `BARCODE ${p.x},${p.y},"128",${Math.round(barHeight)},${humanReadable},${p.rot},${moduleWidth},${moduleWidth * 2},"${barcodeStr}"\r\n`
      }
      continue
    }

    const text = resolveElementText(el, safeData)
    if (!text) continue

    const sizeKey = el.fontSize || (el.large ? 'large' : 'medium')
    const font = TEXT_FONT_CODE[sizeKey] ?? TEXT_FONT_CODE.medium
    const charWidth = TEXT_CHAR_WIDTH_DOTS[sizeKey] ?? TEXT_CHAR_WIDTH_DOTS.medium
    const glyphH = TEXT_GLYPH_HEIGHT_DOTS[sizeKey] ?? TEXT_GLYPH_HEIGHT_DOTS.medium
    const textWidthDots = text.length * charWidth
    const x = alignX(align, widthDots, textWidthDots, offsetXDots)
    const yText = y + Math.max(0, Math.floor((block.height - glyphH) / 2))
    const safeText = text.replace(/"/g, '').replace(/[\r\n]+/g, ' ')
    const p = place(x, yText, textWidthDots, glyphH)
    tspl += `TEXT ${p.x},${p.y},${font},${p.rot},1,1,"${safeText}"\r\n`
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
