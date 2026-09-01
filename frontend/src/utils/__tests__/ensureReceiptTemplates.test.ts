import { describe, it, expect } from 'vitest'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import { ensureTemplateHasLogoBlock, normalizeReceiptTemplates } from '@/utils/ensureReceiptTemplates'

describe('ensureReceiptTemplates', () => {
  it('adds logo block to templates missing one', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.entries = tpl.entries.filter((e) => e.type !== 'image')
    const next = ensureTemplateHasLogoBlock(tpl, 'https://example.com/logo.png')
    expect(next.entries[0]?.type).toBe('image')
    const logoEntry = next.entries[0]
    if (logoEntry?.type === 'image') {
      expect(logoEntry.imageURL).toBe('https://example.com/logo.png')
    }
  })

  it('seeds restaurant bill template for restaurant_cafe business type', () => {
    const result = normalizeReceiptTemplates({}, { businessType: 'restaurant_cafe' })
    expect(result.customTemplates.length).toBe(1)
    expect(result.customTemplates[0]?.name).toBe('Restaurant Bill')
    expect(result.customTemplates[0]?.entries.find((e) => e.type === 'table' && e.tableType === 'advanced')).toBeTruthy()
    expect(result.activeCustomTemplateId).toBe(result.customTemplates[0]?.id)
    expect(result.shouldPersist).toBe(true)
  })

  it('adds restaurant bill template when only the default shop receipt exists', () => {
    const shop = createDefaultReceiptTemplate('Standard Shop Receipt')
    const result = normalizeReceiptTemplates(
      { customTemplates: [shop], activeCustomTemplateId: shop.id },
      { businessType: 'restaurant_cafe' }
    )
    expect(result.customTemplates).toHaveLength(2)
    expect(result.customTemplates.some((t) => t.name === 'Restaurant Bill')).toBe(true)
    expect(result.activeCustomTemplateId).toBe('receipt-tpl-restaurant-bill')
    expect(result.shouldPersist).toBe(true)
  })

  it('seeds standard template when cloud has none', () => {
    const result = normalizeReceiptTemplates({}, { businessLogoURL: 'https://example.com/logo.png' })
    expect(result.customTemplates.length).toBe(1)
    expect(result.customTemplates[0]?.name).toBe('Standard Shop Receipt')
    expect(result.customTemplates[0]?.entries[0]?.type).toBe('image')
    expect(result.shouldPersist).toBe(true)
  })

  it('migrates existing templates without logo block', () => {
    const legacy = createDefaultReceiptTemplate('Standard Shop Receipt')
    legacy.entries = legacy.entries.filter((e) => e.type !== 'image')
    const result = normalizeReceiptTemplates(
      { customTemplates: [legacy], activeCustomTemplateId: legacy.id },
      { businessLogoURL: 'https://example.com/logo.png' }
    )
    expect(result.customTemplates[0]?.entries[0]?.type).toBe('image')
    expect(result.shouldPersist).toBe(true)
  })

  it('does not resurrect a deleted standard template', () => {
    const custom = createDefaultReceiptTemplate('My Custom Receipt')
    const result = normalizeReceiptTemplates(
      { customTemplates: [custom], activeCustomTemplateId: custom.id },
      { businessLogoURL: 'https://example.com/logo.png' }
    )
    expect(result.customTemplates).toHaveLength(1)
    expect(result.customTemplates[0]?.name).toBe('My Custom Receipt')
  })

  it('is idempotent so repeated reads do not trigger endless re-saves', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    const first = normalizeReceiptTemplates(
      { customTemplates: [tpl], activeCustomTemplateId: tpl.id },
      { businessLogoURL: 'https://example.com/logo.png' }
    )
    const second = normalizeReceiptTemplates(
      { customTemplates: first.customTemplates, activeCustomTemplateId: first.activeCustomTemplateId },
      { businessLogoURL: 'https://example.com/logo.png' }
    )
    expect(second.shouldPersist).toBe(false)
    expect(second.customTemplates[0]).toBe(first.customTemplates[0])
  })

  it('keeps updatedAt stable when only syncing the logo', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.updatedAt = '2026-01-01T00:00:00.000Z'
    const next = ensureTemplateHasLogoBlock(tpl, 'https://example.com/logo.png')
    expect(next.updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('seeds the default QR as a UPI payment code when a valid UPI ID is provided', () => {
    const result = normalizeReceiptTemplates({}, { upiId: 'shop@okhdfcbank' })
    const qr = result.customTemplates[0]?.entries.find((e) => e.type === 'barcode')
    expect(qr?.type).toBe('barcode')
    if (qr?.type === 'barcode') {
      expect(qr.qrType).toBe('upi')
      expect(qr.value).toBe('{{upi_qr}}')
      expect(qr.upiId).toBe('shop@okhdfcbank')
    }
    const caption = result.customTemplates[0]?.entries.find(
      (e) => e.type === 'text' && /scan/i.test(e.type === 'text' ? e.text : '')
    )
    expect(caption && caption.type === 'text' ? caption.text : '').toBe('SCAN TO PAY VIA UPI')
  })
})
