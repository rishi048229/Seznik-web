import { describe, it, expect } from 'vitest';
import { calculateReturnSummary, type OriginalSaleItem, type ReturnItemRequest } from '@shared/saleReturnCalculator';
import { calculateGstBill, round2 } from '@shared/gstTaxEngine';

describe('Sale Exchange & Replacement Calculations', () => {
  // -------------------------------------------------------------------------
  // 1. Inward Leg (Return) & Outward Leg (Sale) Linkage with Rate Mismatch
  // -------------------------------------------------------------------------
  it('correctly models an exchange with rate mismatch (5% returned vs 18% issued)', () => {
    // Return Leg: 1 unit of 5% GST item (Rs. 1000 + 5% = Rs. 1050)
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'prod-5pct',
        productName: 'Cotton Kurta (5% GST)',
        quantity: 1,
        sellingPrice: 1000,
        taxRate: 5,
        priceIncludesGst: false,
        total: 1050,
      },
    ];

    const returnRequest: ReturnItemRequest[] = [
      { productId: 'prod-5pct', quantity: 1, restock: true },
    ];

    const returnLeg = calculateReturnSummary(originalItems, returnRequest, 0);
    expect(returnLeg.subtotal).toBe(1000);
    expect(returnLeg.totalTax).toBe(50);
    expect(returnLeg.refundAmount).toBe(1050);

    // New Sale Leg: 1 unit of 18% GST item (Rs. 1500 + 18% = Rs. 1770)
    const newSaleBill = calculateGstBill({
      lineItems: [
        {
          id: 'prod-18pct',
          name: 'Silk Jacket (18% GST)',
          price: 1500,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
        },
      ],
    });

    expect(newSaleBill.totalTaxableValue).toBe(1500);
    expect(newSaleBill.totalTax).toBe(270);
    expect(newSaleBill.finalInvoiceTotal).toBe(1770);

    // Difference Amount Settlement:
    // Net cash customer owes: 1770 - 1050 = 720
    const differenceAmount = round2(newSaleBill.finalInvoiceTotal - returnLeg.refundAmount);
    expect(differenceAmount).toBe(720);

    // Independent tax reduction & addition:
    // Tax reduced by return: 50
    // Tax added by new sale: 270
    // Net tax collected delta = +220
    const netTaxDelta = round2(newSaleBill.totalTax - returnLeg.totalTax);
    expect(netTaxDelta).toBe(220);
  });

  // -------------------------------------------------------------------------
  // 2. Even Exchange (Difference == 0)
  // -------------------------------------------------------------------------
  it('correctly calculates even exchange (size / color swap for same price)', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'shirt-m',
        productName: 'Polo Shirt (Size M)',
        quantity: 1,
        sellingPrice: 999,
        taxRate: 5,
        priceIncludesGst: true,
        total: 999,
      },
    ];

    const returnLeg = calculateReturnSummary(originalItems, [{ productId: 'shirt-m', quantity: 1, restock: true }], 0);
    expect(returnLeg.refundAmount).toBe(999);

    const newSaleBill = calculateGstBill({
      lineItems: [
        {
          id: 'shirt-l',
          name: 'Polo Shirt (Size L)',
          price: 999,
          qty: 1,
          gstRate: 5,
          priceType: 'inclusive',
        },
      ],
    });

    const differenceAmount = round2(newSaleBill.finalInvoiceTotal - returnLeg.refundAmount);
    expect(differenceAmount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Downgrade / Store Credit (Difference < 0)
  // -------------------------------------------------------------------------
  it('handles downgrade exchange where store owes customer a refund / credit', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'premium-shoes',
        productName: 'Premium Leather Shoes',
        quantity: 1,
        sellingPrice: 3000,
        taxRate: 18,
        priceIncludesGst: true,
        total: 3000,
      },
    ];

    const returnLeg = calculateReturnSummary(originalItems, [{ productId: 'premium-shoes', quantity: 1, restock: true }], 0);
    expect(returnLeg.refundAmount).toBe(3000);

    const newSaleBill = calculateGstBill({
      lineItems: [
        {
          id: 'casual-sneakers',
          name: 'Casual Sneakers',
          price: 2200,
          qty: 1,
          gstRate: 18,
          priceType: 'inclusive',
        },
      ],
    });

    const differenceAmount = round2(newSaleBill.finalInvoiceTotal - returnLeg.refundAmount);
    expect(differenceAmount).toBe(-800); // Store refunds Rs. 800 or issues Rs. 800 store credit
  });

  // -------------------------------------------------------------------------
  // 4. Defective Return Item (restock: false) Preserves Credit Value
  // -------------------------------------------------------------------------
  it('preserves full return credit value when an item is defective (restock: false)', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'defective-fan',
        productName: 'Table Fan (Defective)',
        quantity: 1,
        sellingPrice: 1200,
        taxRate: 18,
        priceIncludesGst: false,
        total: 1416,
      },
    ];

    const returnLeg = calculateReturnSummary(
      originalItems,
      [{ productId: 'defective-fan', quantity: 1, restock: false }],
      0
    );

    expect(returnLeg.items[0].restock).toBe(false);
    expect(returnLeg.refundAmount).toBe(1416);
  });

  // -------------------------------------------------------------------------
  // 5. Mandatory Invariant: Same Product, Same Quantity Must Net to Zero (Tax-Exclusive)
  // -------------------------------------------------------------------------
  it('enforces mandatory invariant: same product (tax-exclusive), same quantity nets to exactly Rs. 0.00', () => {
    // Current live DB product state: sellingPrice = 55, taxRate = 5%, priceIncludesGst = false
    const liveProduct = {
      productId: 'diet-coke-1',
      name: 'Diet Coke',
      sellingPrice: 55,
      taxRate: 5,
      priceIncludesGst: false,
    };

    // Original sale line item (POS storage format: total = 55, taxAmount = 2.75)
    const originalItems: OriginalSaleItem[] = [
      {
        productId: liveProduct.productId,
        productName: liveProduct.name,
        quantity: 1,
        sellingPrice: liveProduct.sellingPrice,
        taxRate: liveProduct.taxRate,
        priceIncludesGst: liveProduct.priceIncludesGst,
        total: 55,
        taxAmount: 2.75,
      },
    ];

    // Inward Leg: Return 1 unit
    const returnLeg = calculateReturnSummary(
      originalItems,
      [{ productId: liveProduct.productId, quantity: 1, restock: true }],
      0
    );

    // Return credit: 55.00 + 2.75 = 57.75
    expect(returnLeg.refundAmount).toBe(57.75);
    expect(returnLeg.subtotal).toBe(55);
    expect(returnLeg.totalTax).toBe(2.75);

    // Outward Leg: Replace with 1 unit of the EXACT SAME product using live DB state
    const newSaleBill = calculateGstBill({
      lineItems: [
        {
          id: liveProduct.productId,
          name: liveProduct.name,
          price: liveProduct.sellingPrice,
          qty: 1,
          gstRate: liveProduct.taxRate,
          priceType: liveProduct.priceIncludesGst ? 'inclusive' : 'exclusive',
        },
      ],
      roundingMode: 'none',
    });

    // Replacement line item must be exactly 57.75
    expect(newSaleBill.lines[0].lineFinalAmount).toBe(57.75);
    expect(newSaleBill.lines[0].lineGstAmount).toBe(2.75);

    // Replacement header total must equal the exact sum of line items (57.75)
    expect(newSaleBill.finalInvoiceTotal).toBe(57.75);
    expect(newSaleBill.totalTaxableValue).toBe(55);
    expect(newSaleBill.totalTax).toBe(2.75);

    // Difference must be EXACTLY 0.00
    const differenceAmount = round2(newSaleBill.finalInvoiceTotal - returnLeg.refundAmount);
    expect(differenceAmount).toBe(0.00);
  });

  // -------------------------------------------------------------------------
  // 6. Mandatory Invariant: Same Product, Same Quantity Must Net to Zero (Tax-Inclusive)
  // -------------------------------------------------------------------------
  it('enforces mandatory invariant: same product (tax-inclusive), same quantity nets to exactly Rs. 0.00', () => {
    // Current live DB product state: sellingPrice = 55, taxRate = 5%, priceIncludesGst = true
    const liveProduct = {
      productId: 'diet-coke-incl',
      name: 'Diet Coke (MRP Inclusive)',
      sellingPrice: 55,
      taxRate: 5,
      priceIncludesGst: true,
    };

    // Original sale line item (total = 55)
    const originalItems: OriginalSaleItem[] = [
      {
        productId: liveProduct.productId,
        productName: liveProduct.name,
        quantity: 1,
        sellingPrice: liveProduct.sellingPrice,
        taxRate: liveProduct.taxRate,
        priceIncludesGst: liveProduct.priceIncludesGst,
        total: 55,
      },
    ];

    // Inward Leg: Return 1 unit
    const returnLeg = calculateReturnSummary(
      originalItems,
      [{ productId: liveProduct.productId, quantity: 1, restock: true }],
      0
    );

    // Return credit: 55.00 (taxable 52.38 + tax 2.62)
    expect(returnLeg.refundAmount).toBe(55);
    expect(returnLeg.subtotal).toBe(52.38);
    expect(returnLeg.totalTax).toBe(2.62);

    // Outward Leg: Replace with 1 unit of the EXACT SAME product
    const newSaleBill = calculateGstBill({
      lineItems: [
        {
          id: liveProduct.productId,
          name: liveProduct.name,
          price: liveProduct.sellingPrice,
          qty: 1,
          gstRate: liveProduct.taxRate,
          priceType: liveProduct.priceIncludesGst ? 'inclusive' : 'exclusive',
        },
      ],
      roundingMode: 'none',
    });

    // Replacement total: 55.00
    expect(newSaleBill.finalInvoiceTotal).toBe(55);
    expect(newSaleBill.totalTaxableValue).toBe(52.38);
    expect(newSaleBill.totalTax).toBe(2.62);

    // Difference must be EXACTLY 0.00
    const differenceAmount = round2(newSaleBill.finalInvoiceTotal - returnLeg.refundAmount);
    expect(differenceAmount).toBe(0.00);
  });
});
