import { describe, expect, it } from 'vitest'
import { computePurchaseLineGst, computeSaleLineGst, buildGstLedger } from '../gstLedger'
import type { Sale } from '@/types/sale.types'
import type { Purchase } from '@/types/purchase.types'
import type { Product } from '@/types/product.types'

describe('computeSaleLineGst', () => {
  it('extracts GST from an inclusive line', () => {
    const gst = computeSaleLineGst({
      productName: 'Oil',
      quantity: 1,
      sellingPrice: 118,
      discount: 0,
      taxRate: 18,
      priceIncludesGst: true,
    })
    expect(gst.taxable).toBe(100)
    expect(gst.tax).toBe(18)
  })

  it('adds GST on an exclusive line', () => {
    const gst = computeSaleLineGst({
      productName: 'Soap',
      quantity: 2,
      sellingPrice: 50,
      discount: 0,
      taxRate: 18,
      priceIncludesGst: false,
    })
    expect(gst.taxable).toBe(100)
    expect(gst.tax).toBe(18)
  })

  it('applies discount before GST', () => {
    const gst = computeSaleLineGst({
      productName: 'Tea',
      quantity: 1,
      sellingPrice: 118,
      discount: 18,
      taxRate: 18,
      priceIncludesGst: true,
    })
    expect(gst.taxable).toBe(84.75)
    expect(gst.tax).toBe(15.25)
  })
})

describe('computePurchaseLineGst', () => {
  it('extracts GST from an inclusive purchase cost', () => {
    const gst = computePurchaseLineGst(
      { productName: 'Oil', quantity: 1, costPrice: 118 },
      { taxRate: 18, priceIncludesGst: true },
    )
    expect(gst.taxable).toBe(100)
    expect(gst.tax).toBe(18)
  })
})

describe('buildGstLedger', () => {
  it('nets collected sales GST against purchase GST', () => {
    const sales: Sale[] = [{
      id: 's1',
      invoiceNumber: 'INV-1',
      items: [{
        productId: 'p1',
        productName: 'Oil',
        quantity: 1,
        sellingPrice: 118,
        discount: 0,
        taxRate: 18,
        priceIncludesGst: true,
        taxAmount: 0,
        total: 118,
      }],
      subtotal: 118,
      totalDiscount: 0,
      totalTax: 18,
      grandTotal: 118,
      paymentMethod: 'cash',
      amountPaid: 118,
      changeReturned: 0,
      isQuickBill: false,
      createdAt: '2026-09-08T10:00:00.000Z',
    }]
    const purchases: Purchase[] = [{
      id: 'b1',
      invoiceNumber: 'PO-1',
      supplierId: 'sup',
      items: [{ productId: 'p1', productName: 'Oil', quantity: 1, costPrice: 118, total: 118 }],
      subtotal: 118,
      totalTax: 0,
      grandTotal: 118,
      paymentMethod: 'cash',
      amountPaid: 118,
      createdAt: '2026-09-08T09:00:00.000Z',
    }]
    const products: Product[] = [{
      id: 'p1',
      name: 'Oil',
      sku: 'OIL',
      categoryId: 'c',
      costPrice: 100,
      sellingPrice: 118,
      taxRate: 18,
      priceIncludesGst: true,
      currentStock: 1,
      lowStockThreshold: 1,
      unit: 'piece',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]
    const ledger = buildGstLedger({
      sales,
      purchases,
      products,
      startTs: 0,
      endTs: Date.now(),
      inRange: () => true,
    })
    expect(ledger.collected).toBe(18)
    expect(ledger.paid).toBe(18)
    expect(ledger.net).toBe(0)
    expect(ledger.rates[0].rate).toBe(18)
    expect(ledger.products[0].productName).toBe('Oil')
  })
})
