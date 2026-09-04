import {
  receiptFontCssFamily,
  DEFAULT_RECEIPT_FONT,
  type ReceiptFontId,
} from '@shared/receiptFonts'

export const RECEIPT_PREVIEW_FONT_FAMILY = receiptFontCssFamily(DEFAULT_RECEIPT_FONT)

export function getReceiptPreviewFontStyle(
  paperWidth: '58mm' | '80mm',
  receiptFont?: ReceiptFontId | null
) {
  return {
    fontFamily: receiptFontCssFamily(receiptFont),
    fontSize: paperWidth === '80mm' ? '10.5px' : '10px',
    lineHeight: 1.35,
  } as const
}

export function getReceiptPreviewMaxWidth(paperWidth: '58mm' | '80mm') {
  return paperWidth === '80mm' ? 360 : 280
}
