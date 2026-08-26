import { describe, it, expect } from 'vitest'
import {
  isBrowserLoadableImageSrc,
  isReceiptEntryEnabled,
  resolveReceiptImageSrc,
  resolveStoreLogoUrl,
  preferPrintableSrc,
} from '@/utils/receiptLogo'
import { ensureTemplateHasLogoBlock } from '@/utils/ensureReceiptTemplates'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'

describe('receiptLogo', () => {
  it('treats missing enabled as true', () => {
    expect(isReceiptEntryEnabled({})).toBe(true)
    expect(isReceiptEntryEnabled({ enabled: true })).toBe(true)
    expect(isReceiptEntryEnabled({ enabled: false })).toBe(false)
  })

  it('rejects device-local URIs for browser preview', () => {
    expect(isBrowserLoadableImageSrc('file:///tmp/logo.png')).toBe(false)
    expect(isBrowserLoadableImageSrc('content://media/logo.png')).toBe(false)
    expect(isBrowserLoadableImageSrc('data:image/png;base64,abc')).toBe(true)
    expect(isBrowserLoadableImageSrc('https://cdn.example.com/logo.png')).toBe(true)
  })

  it('falls back when image block only has a local uri', () => {
    const src = resolveReceiptImageSrc(
      { imageUri: 'file:///tmp/logo.png' },
      'https://cdn.example.com/store-logo.png'
    )
    expect(src).toBe('https://cdn.example.com/store-logo.png')
  })

  it('prefers receipt logo over business logo', () => {
    expect(
      resolveStoreLogoUrl({ logoURL: 'https://receipt/logo.png' }, 'https://business/logo.png')
    ).toBe('https://receipt/logo.png')
  })

  it('skips device-local receipt logos and uses the business logo', () => {
    expect(
      resolveStoreLogoUrl({ logoURL: 'file:///var/mobile/logo.png' }, 'https://cdn.example.com/logo.png')
    ).toBe('https://cdn.example.com/logo.png')
  })

  it('prefers inlined data URLs for print', () => {
    expect(
      preferPrintableSrc(
        'https://cdn.example.com/logo.png',
        'data:image/png;base64,abc'
      )
    ).toBe('data:image/png;base64,abc')
  })
})

describe('ensureTemplateHasLogoBlock local uri migration', () => {
  it('replaces stale mobile file uri with cloud logo', () => {
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.entries[0] = {
      ...(tpl.entries[0] as any),
      type: 'image',
      enabled: true,
      imageUri: 'file:///var/mobile/logo.png',
    }
    const next = ensureTemplateHasLogoBlock(tpl, 'https://cdn.example.com/logo.png')
    const logoEntry = next.entries.find((e) => e.type === 'image')
    expect(logoEntry?.type).toBe('image')
    if (logoEntry?.type === 'image') {
      expect(logoEntry.imageURL).toBe('https://cdn.example.com/logo.png')
      expect(logoEntry.imageUri).toBeUndefined()
    }
  })
})

describe('generateReceiptHTML logo', () => {
  it('embeds a data-URL store logo on thermal receipts', async () => {
    const { generateReceiptHTML } = await import('@/utils/receipt')
    const tpl = createDefaultReceiptTemplate('Test')
    tpl.entries[0] = { ...(tpl.entries[0] as any), type: 'image', enabled: true, imageURL: 'data:image/png;base64,abc' }
    const html = generateReceiptHTML({
      sale: {
        id: '1',
        invoiceNumber: 'INV-1',
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        paymentMethod: 'cash',
        amountPaid: 0,
        changeReturned: 0,
        isQuickBill: false,
        createdAt: '2026-08-26T00:00:00.000Z',
      },
      receiptConfig: {
        logoURL: 'data:image/png;base64,abc',
        showLogo: true,
        customTemplates: [tpl],
        activeCustomTemplateId: tpl.id,
      },
      width: '50mm',
      logoURL: 'data:image/png;base64,abc',
    })
    expect(html).toContain('<img')
    expect(html).toContain('data:image/png;base64,abc')
  })

  it('does not emit a file:// logo on web print HTML', async () => {
    const { generateReceiptHTML } = await import('@/utils/receipt')
    const tpl = createDefaultReceiptTemplate('Test')
    const html = generateReceiptHTML({
      sale: {
        id: '1',
        invoiceNumber: 'INV-1',
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        paymentMethod: 'cash',
        amountPaid: 0,
        changeReturned: 0,
        isQuickBill: false,
        createdAt: '2026-08-26T00:00:00.000Z',
      },
      receiptConfig: {
        logoURL: 'file:///var/mobile/logo.png',
        showLogo: true,
        customTemplates: [tpl],
        activeCustomTemplateId: tpl.id,
      },
      width: '50mm',
      logoURL: 'file:///var/mobile/logo.png',
    })
    expect(html).not.toContain('file://')
  })
})
