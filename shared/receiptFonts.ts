/**
 * Curated receipt typeface library — synced web ↔ mobile via PrinterConfig.receiptFont.
 *
 * Preview + HTML / system-driver prints use the CSS / React Native families below.
 * On web Bluetooth, receipts are rasterized from that HTML so the chosen typeface
 * appears on thermal paper. Native ESC/POS text fallback still uses Font A.
 */

export type ReceiptFontId =
  | 'jetbrains_mono'
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
  /** ESC/POS fonttype: 0 = Font A (12×24 standard), 1 = Font B (9×17 compressed). */
  escPosFont: EscPosFontType
  /** Relative scale factor so character height and width feel identical across typefaces. */
  sizeScale: number
}

export const DEFAULT_RECEIPT_FONT: ReceiptFontId = 'classic'

const ALL_FONT_DEFINITIONS: Record<ReceiptFontId, ReceiptFontDefinition> = {
  jetbrains_mono: {
    id: 'jetbrains_mono',
    label: 'Classic Mono',
    family: 'mono',
    description: 'Crisp monospace thermal receipt typography',
    cssFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    rnFamily: 'IBMPlexMono_500Medium',
    rnFamilyAndroid: 'monospace',
    escPosFont: 0,
    sizeScale: 1.0,
  },
  classic: {
    id: 'classic',
    label: 'Classic Mono',
    family: 'mono',
    description: 'Crisp monospace thermal receipt typography',
    cssFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    rnFamily: 'IBMPlexMono_500Medium',
    rnFamilyAndroid: 'monospace',
    escPosFont: 0,
    sizeScale: 1.0,
  },
  modern: {
    id: 'modern',
    label: 'Modern Mono',
    family: 'mono',
    description: 'IBM Plex Mono — clean technical receipts',
    cssFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    rnFamily: 'IBMPlexMono_500Medium',
    escPosFont: 0,
    sizeScale: 0.95,
  },
  clean: {
    id: 'clean',
    label: 'Clean Sans',
    family: 'sans',
    description: 'IBM Plex Sans — modern neutral sans',
    cssFamily: "'IBM Plex Sans', system-ui, sans-serif",
    rnFamily: 'IBMPlexSans_400Regular',
    escPosFont: 0,
    sizeScale: 0.95,
  },
  business: {
    id: 'business',
    label: 'Business Sans',
    family: 'sans',
    description: 'Helvetica / Arial — standard retail bills',
    cssFamily: "Helvetica, Arial, sans-serif",
    rnFamily: 'Helvetica Neue',
    rnFamilyAndroid: 'sans-serif',
    escPosFont: 0,
    sizeScale: 0.95,
  },
  readable: {
    id: 'readable',
    label: 'Readable Sans',
    family: 'sans',
    description: 'Verdana — wide, clear legibility',
    cssFamily: "Verdana, Geneva, sans-serif",
    rnFamily: 'Verdana',
    rnFamilyAndroid: 'sans-serif-medium',
    escPosFont: 0,
    sizeScale: 0.90,
  },
  serif: {
    id: 'serif',
    label: 'Book Serif',
    family: 'serif',
    description: 'Georgia — elegant editorial receipt',
    cssFamily: "Georgia, serif",
    rnFamily: 'Georgia',
    rnFamilyAndroid: 'serif',
    escPosFont: 0,
    sizeScale: 0.94,
  },
  formal: {
    id: 'formal',
    label: 'Formal Serif',
    family: 'serif',
    description: 'Times — classic formal invoice style',
    cssFamily: "'Times New Roman', Times, serif",
    rnFamily: 'Times New Roman',
    rnFamilyAndroid: 'serif',
    escPosFont: 0,
    sizeScale: 0.98,
  },
}

/** The curated font library shown in the web interface. */
export const RECEIPT_FONT_LIBRARY: readonly ReceiptFontDefinition[] = [
  ALL_FONT_DEFINITIONS.classic,
] as const

const FONT_BY_ID: Record<ReceiptFontId, ReceiptFontDefinition> = ALL_FONT_DEFINITIONS

const RECEIPT_FONT_IDS: readonly ReceiptFontId[] = [
  'jetbrains_mono',
  'classic',
  'modern',
  'clean',
  'business',
  'readable',
  'serif',
  'formal',
]

/** Legacy font id aliases from previous library revisions — map to classic. */
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
  return FONT_BY_ID[resolveReceiptFontId(id)] || ALL_FONT_DEFINITIONS.classic
}

/** Character cell width in printer dots (Font A = 12 dots, Font B = 9 dots). */
export function receiptFontCharWidthDots(id?: ReceiptFontId | null): number {
  const font = getReceiptFont(id)
  return font.escPosFont === 1 ? 9 : 12
}

/**
 * Column count for padded thermal text layout.
 * Font A standard: 32 @ 58mm / 48 @ 80mm.
 * Font B compact: 42 @ 58mm / 64 @ 80mm.
 */
export function receiptFontCols(paper: ThermalPaper, id?: ReceiptFontId | null): number {
  const font = getReceiptFont(id)
  if (font.escPosFont === 1) {
    return paper === '80mm' ? 64 : 42
  }
  return paper === '80mm' ? 48 : 32
}

export function receiptFontCharSpacing(_id?: ReceiptFontId | null): number {
  return 0
}

export function receiptFontIsEmphasized(_id?: ReceiptFontId | null): boolean {
  return false
}

export function receiptFontCssFamily(id?: ReceiptFontId | null): string {
  return getReceiptFont(id).cssFamily
}

export function receiptFontSizeScale(id?: ReceiptFontId | null): number {
  return getReceiptFont(id).sizeScale ?? 1.0
}

export function isReceiptFontMonospace(id?: ReceiptFontId | null): boolean {
  return getReceiptFont(id).family === 'mono'
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

