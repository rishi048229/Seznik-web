/**
 * Curated receipt typeface library — synced web ↔ mobile via PrinterConfig.receiptFont.
 *
 * Preview + HTML / system-driver prints use the CSS / React Native families below.
 * Bluetooth ESC/POS printers only ship built-in Font A (12×24); every library entry
 * maps to Font A so line layout stays consistent across typefaces.
 */

export type ReceiptFontId =
  | 'classic'
  | 'modern'
  | 'clean'
  | 'business'
  | 'readable'
  | 'serif'
  | 'formal'

export type ThermalPaper = '58mm' | '80mm'

/** ESC/POS character font: 0 = Font A (12×24). Kept for API compatibility. */
export type EscPosFontType = 0 | 1

export interface ReceiptFontDefinition {
  id: ReceiptFontId
  /** Short chip label shown in Printers UI. */
  label: string
  /** Typeface family category for grouping / copy. */
  family: 'mono' | 'sans' | 'serif'
  /** One-line description under the chip. */
  description: string
  /** CSS font-family stack for web preview + HTML thermal / system print. */
  cssFamily: string
  /** React Native fontFamily (iOS-oriented; see rnFamilyAndroid). */
  rnFamily: string
  /** Android React Native fontFamily when it differs from iOS. */
  rnFamilyAndroid?: string
  /** ESC/POS fonttype option (native + EscPosBuilder). Always Font A for bill fonts. */
  escPosFont: EscPosFontType
}

export const DEFAULT_RECEIPT_FONT: ReceiptFontId = 'classic'

export const RECEIPT_FONT_LIBRARY: readonly ReceiptFontDefinition[] = [
  {
    id: 'classic',
    label: 'Classic Mono',
    family: 'mono',
    description: 'Courier — traditional thermal receipt look',
    cssFamily: "'Courier New', Courier, ui-monospace, monospace",
    rnFamily: 'Courier',
    rnFamilyAndroid: 'monospace',
    escPosFont: 0,
  },
  {
    id: 'modern',
    label: 'Modern Mono',
    family: 'mono',
    description: 'IBM Plex Mono — clean technical receipts',
    cssFamily: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    rnFamily: 'IBMPlexMono_500Medium',
    escPosFont: 0,
  },
  {
    id: 'clean',
    label: 'Clean Sans',
    family: 'sans',
    description: 'IBM Plex Sans — neutral modern bills',
    cssFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    rnFamily: 'IBMPlexSans_400Regular',
    escPosFont: 0,
  },
  {
    id: 'business',
    label: 'Business Sans',
    family: 'sans',
    description: 'Helvetica / Arial — everyday shop bills',
    cssFamily: "Helvetica, 'Helvetica Neue', Arial, 'Segoe UI', sans-serif",
    rnFamily: 'Helvetica Neue',
    rnFamilyAndroid: 'sans-serif',
    escPosFont: 0,
  },
  {
    id: 'readable',
    label: 'Readable Sans',
    family: 'sans',
    description: 'Verdana — wide, easy-to-scan body text',
    cssFamily: "Verdana, Geneva, Tahoma, 'Segoe UI', sans-serif",
    rnFamily: 'Verdana',
    rnFamilyAndroid: 'sans-serif-medium',
    escPosFont: 0,
  },
  {
    id: 'serif',
    label: 'Book Serif',
    family: 'serif',
    description: 'Georgia — soft editorial invoice style',
    cssFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif",
    rnFamily: 'Georgia',
    rnFamilyAndroid: 'serif',
    escPosFont: 0,
  },
  {
    id: 'formal',
    label: 'Formal Serif',
    family: 'serif',
    description: 'Times — classic printed invoice look',
    cssFamily: "'Times New Roman', Times, 'Liberation Serif', serif",
    rnFamily: 'Times New Roman',
    rnFamilyAndroid: 'serif',
    escPosFont: 0,
  },
] as const

const FONT_BY_ID = Object.fromEntries(RECEIPT_FONT_LIBRARY.map((f) => [f.id, f])) as Record<
  ReceiptFontId,
  ReceiptFontDefinition
>

const RECEIPT_FONT_IDS: readonly ReceiptFontId[] = RECEIPT_FONT_LIBRARY.map((f) => f.id)

/** Legacy id from the first library revision — map to Classic Mono. */
const LEGACY_RECEIPT_FONT_ALIASES: Record<string, ReceiptFontId> = {
  compact: 'classic',
}

export function isReceiptFontId(value: unknown): value is ReceiptFontId {
  return typeof value === 'string' && (RECEIPT_FONT_IDS as readonly string[]).includes(value)
}

export function resolveReceiptFontId(value: unknown): ReceiptFontId {
  if (isReceiptFontId(value)) return value
  if (typeof value === 'string' && LEGACY_RECEIPT_FONT_ALIASES[value]) {
    return LEGACY_RECEIPT_FONT_ALIASES[value]!
  }
  return DEFAULT_RECEIPT_FONT
}

export function getReceiptFont(id?: ReceiptFontId | null): ReceiptFontDefinition {
  return FONT_BY_ID[resolveReceiptFontId(id)]
}

/** Character cell width in printer dots (always Font A / 12 for bill fonts). */
export function receiptFontCharWidthDots(_id?: ReceiptFontId | null): number {
  return 12
}

/**
 * Column count for padded thermal text layout.
 * Bill fonts use Font A: 32 @ 58mm / 48 @ 80mm.
 */
export function receiptFontCols(paper: ThermalPaper, _id?: ReceiptFontId | null): number {
  return paper === '80mm' ? 48 : 32
}

export function receiptFontCssFamily(id?: ReceiptFontId | null): string {
  return getReceiptFont(id).cssFamily
}

export function receiptFontRnFamily(
  id?: ReceiptFontId | null,
  platform?: 'ios' | 'android' | 'web' | string | null
): string {
  const font = getReceiptFont(id)
  if (platform === 'android' && font.rnFamilyAndroid) return font.rnFamilyAndroid
  return font.rnFamily
}

export function receiptFontEscPosType(id?: ReceiptFontId | null): EscPosFontType {
  return getReceiptFont(id).escPosFont
}
