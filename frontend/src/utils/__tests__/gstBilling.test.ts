import { describe, it, expect } from 'vitest'
import {
  parseGstBilling,
  resolveReceiptPrintGst,
  shouldPrintGstBreakdown,
} from '@/constants/gstBilling'

describe('resolveReceiptPrintGst', () => {
  it('falls back to legacy receiptConfig.showTaxBreakdown when gstBilling is unconfigured', () => {
    const legacyOn = resolveReceiptPrintGst({}, { showTaxBreakdown: true })
    expect(legacyOn.showTaxBreakdown).toBe(true)
    expect(legacyOn.gstStyle).toBe('tax_invoice')
    expect(legacyOn.itemWiseGst).toBe(true)

    const legacyOff = resolveReceiptPrintGst({}, { showTaxBreakdown: false })
    expect(legacyOff.showTaxBreakdown).toBe(false)
    expect(legacyOff.gstStyle).toBeUndefined()
    expect(legacyOff.itemWiseGst).toBe(false)
  })

  it('uses configured gstBilling print settings when present', () => {
    const invoiceConfig = {
      gstBilling: {
        showBreakdown: true,
        style: 'slab_wise',
        printOnReceipt: true,
        itemWiseGst: true,
      },
    }
    const gst = parseGstBilling(invoiceConfig)
    expect(gst.configured).toBe(true)

    const resolved = resolveReceiptPrintGst(invoiceConfig, { showTaxBreakdown: false })
    expect(resolved.showTaxBreakdown).toBe(true)
    expect(resolved.gstStyle).toBe('slab_wise')
    expect(resolved.itemWiseGst).toBe(true)
  })

  it('hides tax when printOnReceipt is off; compact still prints with gstStyle compact', () => {
    const off = resolveReceiptPrintGst(
      { gstBilling: { showBreakdown: true, style: 'tax_invoice', printOnReceipt: false, itemWiseGst: false } },
      { showTaxBreakdown: true }
    )
    expect(off.showTaxBreakdown).toBe(false)

    const compact = resolveReceiptPrintGst(
      { gstBilling: { showBreakdown: true, style: 'compact', printOnReceipt: true, itemWiseGst: false } },
      { showTaxBreakdown: true }
    )
    expect(compact.showTaxBreakdown).toBe(true)
    expect(compact.gstStyle).toBe('compact')
    expect(shouldPrintGstBreakdown(parseGstBilling({ gstBilling: { showBreakdown: true, style: 'compact', printOnReceipt: true, itemWiseGst: false } }), true)).toBe(true)
  })
})
