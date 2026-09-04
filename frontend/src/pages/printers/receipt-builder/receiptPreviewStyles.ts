import {
  receiptFontCssFamily,
  receiptFontSizeScale,
  DEFAULT_RECEIPT_FONT,
  type ReceiptFontId,
} from '@shared/receiptFonts'

export const RECEIPT_PREVIEW_FONT_FAMILY = receiptFontCssFamily(DEFAULT_RECEIPT_FONT)

export function getReceiptPreviewFontStyle(
  paperWidth: '58mm' | '80mm',
  receiptFont?: ReceiptFontId | null
) {
  const scale = receiptFontSizeScale(receiptFont)
  const baseSize = paperWidth === '80mm' ? 10.5 : 10
  const normalizedFs = `${(baseSize * scale).toFixed(1)}px`
  return {
    fontFamily: receiptFontCssFamily(receiptFont),
    fontSize: normalizedFs,
    lineHeight: 1.35,
  } as const
}

export function getReceiptPreviewMaxWidth(paperWidth: '58mm' | '80mm') {
  return paperWidth === '80mm' ? 360 : 280
}
