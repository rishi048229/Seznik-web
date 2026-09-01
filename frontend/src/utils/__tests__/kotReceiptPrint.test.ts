import { describe, it, expect } from 'vitest'
import { resolveKotReceiptPrintContext } from '@/utils/kotReceiptPrint'
import { RESTAURANT_RECEIPT_TEMPLATE_NAME } from '@/utils/restaurantReceiptTemplate'

describe('resolveKotReceiptPrintContext', () => {
  it('uses the restaurant bill template for KOT printing', () => {
    const ctx = resolveKotReceiptPrintContext({
      businessName: 'Spice Garden',
      receiptConfig: {},
    })
    expect(ctx.template.name).toBe(RESTAURANT_RECEIPT_TEMPLATE_NAME)
    expect(ctx.receiptConfig.activeCustomTemplateId).toBe(ctx.template.id)
    expect(ctx.receiptConfig.customTemplates?.some((t) => t.name === RESTAURANT_RECEIPT_TEMPLATE_NAME)).toBe(true)
  })
})
