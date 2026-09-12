import { describe, it, expect } from 'vitest';
import { calculateReturnSummary, type OriginalSaleItem, type ReturnItemRequest } from '@shared/saleReturnCalculator';
import { computePLMetrics } from '@shared/plEngine';
import { round2 } from '@shared/gstTaxEngine';

describe('Sales Return & Refund Calculations', () => {
  // -------------------------------------------------------------------------
  // 1. Reconciliation Invariant: subtotal + totalTax + extraChargesRefunded === refundAmount
  // -------------------------------------------------------------------------
  it('enforces exact reconciliation invariant across various GST rates and quantities', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'prod-1',
        productName: 'Rice 5kg (0% GST)',
        quantity: 2,
        sellingPrice: 300,
        taxRate: 0,
        total: 600,
      },
      {
        productId: 'prod-2',
        productName: 'Edible Oil (5% GST Incl)',
        quantity: 4,
        sellingPrice: 150,
        taxRate: 5,
        priceIncludesGst: true,
        total: 600,
      },
      {
        productId: 'prod-3',
        productName: 'Biscuits (18% GST Excl)',
        quantity: 10,
        sellingPrice: 50,
        taxRate: 18,
        priceIncludesGst: false,
        total: 590, // 500 + 90 GST
      },
    ];

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'prod-1', quantity: 1, restock: true },
      { productId: 'prod-2', quantity: 2, restock: true },
      { productId: 'prod-3', quantity: 3, restock: false },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    // Invariant check
    const calculated = round2(summary.subtotal + summary.totalTax + summary.extraChargesRefunded);
    expect(calculated).toBe(summary.refundAmount);
    expect(summary.items.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 2. Proportional Scaling on Discounted Line Items
  // -------------------------------------------------------------------------
  it('correctly scales returned line items that received item discounts at sale time', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'item-disc',
        productName: 'T-Shirt',
        quantity: 5,
        unitPrice: 1000,
        sellingPrice: 1000,
        taxRate: 18,
        discount: 500, // Rs. 500 off across 5 units -> net 4500 + GST 810 = 5310 total
        total: 5310,
      },
    ];

    // Customer returns 2 units out of 5 (40%)
    const returnRequests: ReturnItemRequest[] = [
      { productId: 'item-disc', quantity: 2, restock: true },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    // Expected refund = 5310 * (2/5) = 2124.00
    expect(summary.refundAmount).toBe(2124);
    // Taxable = 2124 / 1.18 = 1800.00
    expect(summary.subtotal).toBe(1800);
    // GST = 2124 - 1800 = 324.00
    expect(summary.totalTax).toBe(324);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // -------------------------------------------------------------------------
  // 3. Extra Charges Refund on Full Return
  // -------------------------------------------------------------------------
  it('includes extra charges when explicitly specified on full return', () => {
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'item-1',
        productName: 'Fan',
        quantity: 1,
        sellingPrice: 2000,
        taxRate: 18,
        total: 2360,
      },
    ];

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'item-1', quantity: 1, restock: true },
    ];

    // Refund includes Rs. 100 delivery fee
    const summary = calculateReturnSummary(originalItems, returnRequests, 100);

    expect(summary.refundAmount).toBe(2460); // 2360 items + 100 delivery
    expect(summary.extraChargesRefunded).toBe(100);
    expect(round2(summary.subtotal + summary.totalTax + summary.extraChargesRefunded)).toBe(summary.refundAmount);
  });

  // -------------------------------------------------------------------------
  // 4. P&L Engine Integration with Returns
  // -------------------------------------------------------------------------
  it('correctly feeds returns into unified P&L metrics', () => {
    // Gross Billed: 118,000 (100,000 taxable + 18,000 tax)
    // Return: 11,800 (10,000 taxable + 1,800 tax)
    // Net Tax Collected = 18,000 - 1,800 = 16,200
    // returnsDeducted = 10,000
    // Net Revenue = 118,000 - 10,000 - 16,200 = 91,800
    const pl = computePLMetrics({
      grossBilled: 118000,
      taxCollected: 16200, // (18000 - 1800)
      returnsDeducted: 10000,
      totalCost: 50000,
      totalExpenses: 15000,
    });

    expect(pl.netRevenue).toBe(91800);
    expect(pl.grossProfit).toBe(41800); // 91,800 - 50,000
    expect(pl.netProfit).toBe(26800); // 41,800 - 15,000
    expect(pl.returnsDeducted).toBe(10000);
  });
});
