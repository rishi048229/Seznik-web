export const RECEIPT_PREVIEW_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

export function getReceiptPreviewFontStyle(paperWidth: '58mm' | '80mm') {
  return {
    fontFamily: RECEIPT_PREVIEW_FONT_FAMILY,
    fontSize: paperWidth === '80mm' ? '10.5px' : '10px',
    lineHeight: 1.35,
    fontVariantNumeric: 'tabular-nums' as const,
  }
}

export function getReceiptPreviewMaxWidth(paperWidth: '58mm' | '80mm') {
  return paperWidth === '80mm' ? 360 : 280
}
