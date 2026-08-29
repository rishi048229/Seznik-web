import { describe, it, expect } from 'vitest'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import { compileCustomReceiptTextLines, SAMPLE_RECEIPT_CONTEXT } from '@/utils/customReceiptEngine'
import {
  applyQrSection,
  applyStoreDetails,
  buildStoreDetailsText,
  inferQrPurpose,
  mapTemplateToSimple,
  setSectionEnabled,
  templateRequiresUpiId,
} from '@/pages/printers/receipt-builder/receiptSimpleSections'
import { containsTemplateVar } from '@/utils/receiptTemplateTokens'

describe('receiptSimpleSections', () => {
  it('maps the default template to every Simple section', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const mapped = mapTemplateToSimple(tpl)
    expect(mapped.logo?.type).toBe('image')
    expect(mapped.storeName?.text).toBe('{{store_name}}')
    expect(mapped.storeDetails && containsTemplateVar(mapped.storeDetails.text, 'store_gstin')).toBe(true)
    expect(mapped.invoiceRow?.type).toBe('left_right_text')
    expect(mapped.customerRow?.type).toBe('left_right_text')
    expect(mapped.items?.type).toBe('table')
    expect(mapped.subtotal?.right).toContain('{{subtotal}}')
    expect(mapped.discount?.right).toContain('{{discount}}')
    expect(mapped.tax?.right).toContain('{{tax}}')
    expect(mapped.grandTotal?.right).toContain('{{grand_total}}')
    expect(mapped.qr?.type).toBe('barcode')
    expect(mapped.tokenRow).toBeNull()
    expect(mapped.qrCaption?.text).toMatch(/Scan QR/i)
    expect(mapped.footer?.text).toBe('{{footer_message}}')
    expect(mapped.hasCustomLines).toBe(false)
    expect(mapped.customEntries).toEqual([])
  })

  it('rewrites store-detail text when GSTIN is turned off', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const next = applyStoreDetails(tpl, { address: true, phone: true, gstin: false })
    const mapped = mapTemplateToSimple(next)
    expect(mapped.storeDetails?.enabled).toBe(true)
    expect(mapped.storeDetails?.text).toBe(buildStoreDetailsText({ address: true, phone: true, gstin: false }))
    expect(containsTemplateVar(mapped.storeDetails?.text || '', 'store_gstin')).toBe(false)
    expect(containsTemplateVar(mapped.storeDetails?.text || '', 'store_phone')).toBe(true)
  })

  it('disables store details when every contact field is off', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const next = applyStoreDetails(tpl, { address: false, phone: false, gstin: false })
    const mapped = mapTemplateToSimple(next)
    expect(mapped.storeDetails?.enabled).toBe(false)
    expect(next.entries.some((e) => e.id === mapped.storeDetails?.id)).toBe(true)
  })

  it('disables customer without deleting the block', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const next = setSectionEnabled(tpl, 'customerRow', false)
    const mapped = mapTemplateToSimple(next)
    expect(mapped.customerRow?.enabled).toBe(false)
    expect(next.entries.some((e) => e.type === 'left_right_text' && e.id === mapped.customerRow?.id)).toBe(true)
  })

  it('sets QR purpose to UPI without dropping the block', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const next = applyQrSection(tpl, { purpose: 'upi' })
    const mapped = mapTemplateToSimple(next)
    expect(mapped.qr?.qrType).toBe('upi')
    expect(mapped.qr?.value).toBe('{{upi_qr}}')
    expect(inferQrPurpose(mapped.qr!)).toBe('upi')
    expect(templateRequiresUpiId(next)).toBe(true)
    expect(templateRequiresUpiId(setSectionEnabled(next, 'qr', false))).toBe(false)
  })

  it('treats extra unmatched text as a custom line', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.entries.push({
      id: 'extra-note',
      type: 'text',
      enabled: true,
      text: 'FSSAI: 123',
      size: 'small',
      align: 'center',
    })
    const mapped = mapTemplateToSimple(tpl)
    expect(mapped.hasCustomLines).toBe(true)
    expect(mapped.customEntries.some((e) => e.id === 'extra-note')).toBe(true)
  })

  it('does not list layout dividers as custom lines', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const mapped = mapTemplateToSimple(tpl)
    expect(tpl.entries.some((e) => e.type === 'horizontal_line')).toBe(true)
    expect(mapped.customEntries.some((e) => e.type === 'horizontal_line')).toBe(false)
  })

  it('compiled receipt has no braces after Simple GSTIN toggle', () => {
    const tpl = createDefaultReceiptTemplate('GSTIN off')
    const next = applyStoreDetails(tpl, { address: true, phone: true, gstin: false })
    const lines = compileCustomReceiptTextLines(next, SAMPLE_RECEIPT_CONTEXT, '58mm')
    const text = lines.join('\n')
    expect(text).not.toContain('{{')
    expect(text).not.toMatch(/GSTIN/i)
    expect(text).toContain(SAMPLE_RECEIPT_CONTEXT.storeName)
    expect(text).toContain(SAMPLE_RECEIPT_CONTEXT.storePhone || '')
  })

  it('inserts a token block above the QR when the restaurant section is enabled', () => {
    const tpl = createDefaultReceiptTemplate('Token')
    const next = setSectionEnabled(tpl, 'tokenRow', true)
    const mapped = mapTemplateToSimple(next)
    expect(mapped.tokenRow?.text).toContain('{{token_no}}')
    const qrIdx = next.entries.findIndex((e) => e.type === 'barcode')
    const tokenIdx = next.entries.findIndex((e) => e.id === mapped.tokenRow?.id)
    expect(tokenIdx).toBeGreaterThanOrEqual(0)
    expect(tokenIdx).toBeLessThan(qrIdx)
  })
})
