import { describe, it, expect } from 'vitest';
import {
  calculateReturnSummary,
  type OriginalSaleItem,
  type ReturnItemRequest,
  type OriginalSaleContext,
} from '@shared/saleReturnCalculator';
import { computePLMetrics } from '@shared/plEngine';
import { round2 } from '@shared/gstTaxEngine';

describe('Sales Return & Refund Calculation Engine — 10-Case Compliance & Invariant Verification', () => {
  // =========================================================================
  // CASE 1: FULL INVOICE RETURN, NO DISCOUNT OF ANY KIND
  // =========================================================================
  it('Case 1: Full invoice return with no discount refunds exactly Sale.grandTotal', () => {
    // 3 items: Rice (0% GST), Oil (5% GST Incl), Biscuits (18% GST Excl)
    // Rice: 2 @ 300 = 600
    // Oil: 4 @ 150 (incl 5% GST = 571.43 + 28.57) = 600
    // Biscuits: 10 @ 50 + 18% GST (500 + 90) = 590
    // Total Subtotal = 1671.43, Total Tax = 118.57, Grand Total = 1790.00
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'prod-rice',
        productName: 'Rice 5kg',
        quantity: 2,
        sellingPrice: 300,
        taxRate: 0,
        priceIncludesGst: false,
        total: 600,
      },
      {
        productId: 'prod-oil',
        productName: 'Edible Oil 1L',
        quantity: 4,
        sellingPrice: 150,
        taxRate: 5,
        priceIncludesGst: true,
        taxAmount: 28.57,
        total: 600,
      },
      {
        productId: 'prod-bisc',
        productName: 'Biscuits',
        quantity: 10,
        sellingPrice: 50,
        taxRate: 18,
        priceIncludesGst: false,
        taxAmount: 90,
        total: 590,
      },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 1671.43,
      totalDiscount: 0,
      totalTax: 118.57,
      grandTotal: 1790.0,
    };

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'prod-rice', quantity: 2 },
      { productId: 'prod-oil', quantity: 4 },
      { productId: 'prod-bisc', quantity: 10 },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    expect(summary.refundAmount).toBe(1790.0);
    expect(summary.subtotal).toBe(1671.43);
    expect(summary.totalTax).toBe(118.57);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    expect(summary.items.length).toBe(3);
  });

  // =========================================================================
  // CASE 2: FULL INVOICE RETURN, BILL-LEVEL DISCOUNT WAS APPLIED
  // =========================================================================
  it('Case 2: Full invoice return with bill-level discount refunds exactly Sale.grandTotal (discount already baked in)', () => {
    // Stored invoice INV-00006 fixture from production:
    // Grape Coke (1 @ 70, 5% GST excl = 70 + 3.50 = 73.50)
    // Slice (1 @ 20, 5% GST excl = 20 + 1.00 = 21.00)
    // Diet Coke (1 @ 55, 5% GST excl = 55 + 2.75 = 57.75)
    // Vanilla Coke (1 @ 150, 5% GST excl = 150 + 7.50 = 157.50)
    // Undiscounted total = 309.75. Bill Discount = 19.30 -> Stored grandTotal = 300.00, subtotal = 285.70, totalTax = 14.30
    const originalItems: OriginalSaleItem[] = [
      { productId: 'p1', productName: 'Grape Coke', quantity: 1, sellingPrice: 70, taxRate: 5, priceIncludesGst: false, taxAmount: 3.5, total: 70 },
      { productId: 'p2', productName: 'Slice', quantity: 1, sellingPrice: 20, taxRate: 5, priceIncludesGst: false, taxAmount: 1, total: 20 },
      { productId: 'p3', productName: 'Diet Coke', quantity: 1, sellingPrice: 55, taxRate: 5, priceIncludesGst: false, taxAmount: 2.75, total: 55 },
      { productId: 'p4', productName: 'Vanilla Coke', quantity: 1, sellingPrice: 150, taxRate: 5, priceIncludesGst: false, taxAmount: 7.5, total: 150 },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 285.7,
      totalDiscount: 19.3,
      totalTax: 14.3,
      grandTotal: 300.0,
    };

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
      { productId: 'p3', quantity: 1 },
      { productId: 'p4', quantity: 1 },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    expect(summary.refundAmount).toBe(300.0);
    expect(summary.subtotal).toBe(285.7);
    expect(summary.totalTax).toBe(14.3);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 3: FULL INVOICE RETURN, PRE-CONFIGURED ITEM-LEVEL DISCOUNT
  // =========================================================================
  it('Case 3: Full invoice return with item-level discount refunds exactly Sale.grandTotal', () => {
    // 5 T-shirts @ 1000 each with Rs. 500 total item discount. 18% GST.
    // Taxable = 4500, GST = 810, Grand Total = 5310
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'item-shirt',
        productName: 'T-Shirt',
        quantity: 5,
        sellingPrice: 1000,
        taxRate: 18,
        discount: 500,
        priceIncludesGst: false,
        taxAmount: 810,
        total: 5310,
      },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 4500,
      totalDiscount: 500,
      totalTax: 810,
      grandTotal: 5310,
    };

    const returnRequests: ReturnItemRequest[] = [{ productId: 'item-shirt', quantity: 5 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    expect(summary.refundAmount).toBe(5310);
    expect(summary.subtotal).toBe(4500);
    expect(summary.totalTax).toBe(810);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 4: FULL INVOICE RETURN, BOTH ITEM-LEVEL AND BILL-LEVEL DISCOUNT APPLIED
  // =========================================================================
  it('Case 4: Full invoice return with both item-level and bill-level discount refunds exactly Sale.grandTotal', () => {
    // Item 1: 2 Shoes @ 2000 = 4000. Item discount = 400. Net taxable before bill discount = 3600. 18% GST.
    // Item 2: 1 Socks @ 200 = 200. Item discount = 0. Net taxable before bill discount = 200. 18% GST.
    // Total net taxable before bill disc = 3800.
    // Bill discount = 300. Total Discount = 400 + 300 = 700.
    // Final Taxable = 3500. GST (18%) = 630. Grand Total = 4130.
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'prod-shoes',
        productName: 'Running Shoes',
        quantity: 2,
        sellingPrice: 2000,
        taxRate: 18,
        discount: 400,
        priceIncludesGst: false,
      },
      {
        productId: 'prod-socks',
        productName: 'Sports Socks',
        quantity: 1,
        sellingPrice: 200,
        taxRate: 18,
        discount: 0,
        priceIncludesGst: false,
      },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 3500,
      totalDiscount: 700,
      totalTax: 630,
      grandTotal: 4130,
    };

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'prod-shoes', quantity: 2 },
      { productId: 'prod-socks', quantity: 1 },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    expect(summary.refundAmount).toBe(4130);
    expect(summary.subtotal).toBe(3500);
    expect(summary.totalTax).toBe(630);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 5: PARTIAL RETURN, NO DISCOUNT WAS EVER APPLIED TO THOSE LINES
  // =========================================================================
  it('Case 5: Partial return without discounts scales stored taxable and stored GST proportionally', () => {
    // Original sale: 10 units @ 50 + 18% GST (stored taxable = 500, stored GST = 90, line total = 590)
    // Customer returns 3 units out of 10 (30%)
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'bisc-10',
        productName: 'Biscuits',
        quantity: 10,
        sellingPrice: 50,
        taxRate: 18,
        priceIncludesGst: false,
        taxAmount: 90,
        total: 590,
      },
    ];

    const returnRequests: ReturnItemRequest[] = [{ productId: 'bisc-10', quantity: 3 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    // Expected: 30% of 500 = 150 taxable, 30% of 90 = 27 GST, 30% of 590 = 177 refund
    expect(summary.refundAmount).toBe(177.0);
    expect(summary.subtotal).toBe(150.0);
    expect(summary.totalTax).toBe(27.0);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 6: PARTIAL RETURN, ITEM HAD PRE-CONFIGURED ITEM-LEVEL DISCOUNT
  // =========================================================================
  it('Case 6: Partial return with item discount scales the stored post-discount line values', () => {
    // 5 T-Shirts @ 1000 each with Rs. 500 discount -> stored taxable = 4500, stored GST = 810, stored total = 5310
    // Customer returns 2 units (40%)
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'tshirt-5',
        productName: 'T-Shirt',
        quantity: 5,
        sellingPrice: 1000,
        taxRate: 18,
        discount: 500,
        priceIncludesGst: false,
        taxAmount: 810,
        total: 5310,
      },
    ];

    const returnRequests: ReturnItemRequest[] = [{ productId: 'tshirt-5', quantity: 2 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    // 40% of 5310 = 2124.00, 40% of 4500 = 1800.00, 40% of 810 = 324.00
    expect(summary.refundAmount).toBe(2124.0);
    expect(summary.subtotal).toBe(1800.0);
    expect(summary.totalTax).toBe(324.0);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 7: PARTIAL RETURN, BILL-LEVEL DISCOUNT ACROSS MULTIPLE GST RATES
  // =========================================================================
  it('Case 7: Partial return with bill-level discount scales value-weighted apportioned stored line figures', () => {
    // Item A: 1 unit @ 1000 (18% GST). Baseline taxable = 1000.
    // Item B: 1 unit @ 500 (5% GST). Baseline taxable = 500.
    // Total baseline taxable = 1500.
    // Bill discount = 150 (10% overall discount).
    // Apportionment:
    // Item A gets 100 discount -> taxable = 900, 18% GST = 162, total = 1062.
    // Item B gets 50 discount -> taxable = 450, 5% GST = 22.5, total = 472.5.
    // Grand Total = 1534.50.
    const originalItems: OriginalSaleItem[] = [
      { productId: 'item-a', productName: 'Item A (18%)', quantity: 1, sellingPrice: 1000, taxRate: 18, priceIncludesGst: false },
      { productId: 'item-b', productName: 'Item B (5%)', quantity: 1, sellingPrice: 500, taxRate: 5, priceIncludesGst: false },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 1350,
      totalDiscount: 150,
      totalTax: 184.5,
      grandTotal: 1534.5,
    };

    // Customer returns ONLY Item A
    const returnRequests: ReturnItemRequest[] = [{ productId: 'item-a', quantity: 1 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    expect(summary.refundAmount).toBe(1062.0);
    expect(summary.subtotal).toBe(900.0);
    expect(summary.totalTax).toBe(162.0);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 8: PARTIAL RETURN, COMBINATION OF ITEM-LEVEL AND BILL-LEVEL DISCOUNT ON SAME LINE
  // =========================================================================
  it('Case 8: Partial return with both item and bill discounts scales combined post-discount stored values', () => {
    // Item A: 2 units @ 1000 = 2000. Item discount = 200. Net after item disc = 1800 (18% GST).
    // Item B: 1 unit @ 200. Item discount = 0. Net after item disc = 200 (18% GST).
    // Total net = 2000. Bill discount = 200. Total discount = 400.
    // Apportioned bill discount for Item A = 200 * (1800/2000) = 180.
    // Final taxable for Item A (2 units) = 1800 - 180 = 1620.
    // 18% GST on Item A = 291.60. Total for Item A = 1911.60.
    // Customer returns 1 unit of Item A (50% of Item A).
    const originalItems: OriginalSaleItem[] = [
      { productId: 'item-a', productName: 'Item A', quantity: 2, sellingPrice: 1000, taxRate: 18, discount: 200, priceIncludesGst: false },
      { productId: 'item-b', productName: 'Item B', quantity: 1, sellingPrice: 200, taxRate: 18, discount: 0, priceIncludesGst: false },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 1620 + 180, // 1800
      totalDiscount: 400,
      totalTax: 324,
      grandTotal: 2124,
    };

    const returnRequests: ReturnItemRequest[] = [{ productId: 'item-a', quantity: 1 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0, saleContext);

    // 50% of 1911.60 = 955.80 refund, 50% of 1620 = 810 taxable, 50% of 291.60 = 145.80 GST
    expect(summary.refundAmount).toBe(955.8);
    expect(summary.subtotal).toBe(810.0);
    expect(summary.totalTax).toBe(145.8);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 9: TAX-INCLUSIVE VS TAX-EXCLUSIVE PRICING HANDLED ACCURATELY
  // =========================================================================
  it('Case 9: Correctly splits tax-inclusive and tax-exclusive items using stored sale data without recomputing tax mode', () => {
    // Item 1 (Inclusive): 1 unit @ 105 (5% GST incl). Taxable = 100, GST = 5, Total = 105.
    // Item 2 (Exclusive): 1 unit @ 100 (5% GST excl). Taxable = 100, GST = 5, Total = 105.
    const originalItems: OriginalSaleItem[] = [
      { productId: 'inc-item', productName: 'Inclusive Item', quantity: 1, sellingPrice: 105, taxRate: 5, priceIncludesGst: true, taxAmount: 5, total: 105 },
      { productId: 'exc-item', productName: 'Exclusive Item', quantity: 1, sellingPrice: 100, taxRate: 5, priceIncludesGst: false, taxAmount: 5, total: 105 },
    ];

    const returnRequests: ReturnItemRequest[] = [
      { productId: 'inc-item', quantity: 1 },
      { productId: 'exc-item', quantity: 1 },
    ];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    expect(summary.refundAmount).toBe(210.0);
    expect(summary.subtotal).toBe(200.0);
    expect(summary.totalTax).toBe(10.0);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // CASE 10: CATALOG CHANGES (PRICE, DISCOUNT, TAX MODE CHANGED AFTER SALE)
  // =========================================================================
  it('Case 10: Subsequent catalog price increases, tax changes, or discount removals have ZERO effect on return calculations', () => {
    // Original sale happened when Item was Rs. 100 with 10% discount and 12% GST (total paid = 90 + 10.80 = 100.80)
    // Even if product catalog now has price = 500, discount = 0, tax = 28% GST:
    // The return engine only takes the stored sale item!
    const originalItems: OriginalSaleItem[] = [
      {
        productId: 'legacy-prod',
        productName: 'Legacy Product',
        quantity: 2,
        sellingPrice: 100, // old price
        taxRate: 12, // old tax rate
        discount: 20, // old discount across 2 units
        priceIncludesGst: false,
        taxAmount: 21.6,
        total: 201.6,
      },
    ];

    // Customer returns 1 unit
    const returnRequests: ReturnItemRequest[] = [{ productId: 'legacy-prod', quantity: 1 }];

    const summary = calculateReturnSummary(originalItems, returnRequests, 0);

    // Expected for 1 unit: 50% of 201.60 = 100.80 refund, 50% of 180 = 90 taxable, 50% of 21.60 = 10.80 GST
    expect(summary.refundAmount).toBe(100.8);
    expect(summary.subtotal).toBe(90.0);
    expect(summary.totalTax).toBe(10.8);
    expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
  });

  // =========================================================================
  // MANDATORY INVARIANT 4: CUMULATIVE RETURNS EQUAL EXACT SALE GRAND TOTAL
  // =========================================================================
  it('Mandatory Invariant 4: Sequential partial returns returning every unit one by one sum to EXACTLY Sale.grandTotal with ZERO rounding drift', () => {
    // 3 items with fractional paise:
    // Diet Coke: 1 @ 55 + 5% = 57.75
    // Frooti: 1 @ 10 + 5% = 10.50
    // Vanilla Coke: 1 @ 150 + 5% = 157.50
    // Grand Total = 225.75 (or 225.76 if rounded)
    const originalItems: OriginalSaleItem[] = [
      { productId: 'p1', productName: 'Diet Coke', quantity: 1, sellingPrice: 55, taxRate: 5, priceIncludesGst: false, taxAmount: 2.75, total: 55 },
      { productId: 'p2', productName: 'Frooti', quantity: 1, sellingPrice: 10, taxRate: 5, priceIncludesGst: false, taxAmount: 0.5, total: 10 },
      { productId: 'p3', productName: 'Vanilla Coke', quantity: 1, sellingPrice: 150, taxRate: 5, priceIncludesGst: false, taxAmount: 7.5, total: 150 },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 215,
      totalDiscount: 0,
      totalTax: 10.76,
      grandTotal: 225.76,
      pastReturns: [],
    };

    // Return 1: Customer returns Diet Coke
    const return1 = calculateReturnSummary(originalItems, [{ productId: 'p1', quantity: 1 }], 0, saleContext);
    expect(return1.refundAmount).toBe(57.75);

    // Update past returns on context
    saleContext.pastReturns = [
      {
        items: [{ productId: 'p1', productName: 'Diet Coke', quantity: 1, refundAmount: 57.75 }],
        refundAmount: 57.75,
      },
    ];

    // Return 2: Customer returns Frooti
    const return2 = calculateReturnSummary(originalItems, [{ productId: 'p2', quantity: 1 }], 0, saleContext);
    expect(return2.refundAmount).toBe(10.5);

    // Update past returns on context
    saleContext.pastReturns.push({
      items: [{ productId: 'p2', productName: 'Frooti', quantity: 1, refundAmount: 10.5 }],
      refundAmount: 10.5,
    });

    // Return 3: Customer returns Vanilla Coke (final item on invoice)
    const return3 = calculateReturnSummary(originalItems, [{ productId: 'p3', quantity: 1 }], 0, saleContext);

    // Total of all 3 returns must equal EXACTLY 225.76
    const totalCumulativeRefund = round2(return1.refundAmount + return2.refundAmount + return3.refundAmount);
    expect(totalCumulativeRefund).toBe(saleContext.grandTotal);
    expect(return3.refundAmount).toBe(round2(225.76 - 57.75 - 10.5));
  });

  // =========================================================================
  // MULTI-RATE DISCOUNTED RETURN PRECISION TEST (₹297.44 INVOICE)
  // =========================================================================
  it('correctly handles full and sequential partial returns for multi-rate discounted carts without 1-paisa drift', () => {
    // Original Sale:
    // Grape Coke: 2 units @ ₹70 (12% GST)
    // Vanilla Coke: 1 unit @ ₹150 (5% GST)
    // Slice: 1 unit @ ₹20 (5% GST)
    // Total gross taxable: 310.00, Bill discount: 35.00
    // Stored invoice: subtotal = 275.00, totalTax = 22.44, grandTotal = 297.44
    const originalItems: OriginalSaleItem[] = [
      { productId: 'p-grape', productName: 'Grape Coke', quantity: 2, sellingPrice: 70, taxRate: 12, priceIncludesGst: false },
      { productId: 'p-vanilla', productName: 'Vanilla Coke', quantity: 1, sellingPrice: 150, taxRate: 5, priceIncludesGst: false },
      { productId: 'p-slice', productName: 'Slice', quantity: 1, sellingPrice: 20, taxRate: 5, priceIncludesGst: false },
    ];

    const saleContext: OriginalSaleContext = {
      subtotal: 275.0,
      totalDiscount: 35.0,
      totalTax: 22.44,
      grandTotal: 297.44,
      pastReturns: [],
    };

    // 1. Full return of entire cart: must refund EXACTLY ₹297.44
    const fullReturn = calculateReturnSummary(
      originalItems,
      [
        { productId: 'p-grape', quantity: 2 },
        { productId: 'p-vanilla', quantity: 1 },
        { productId: 'p-slice', quantity: 1 },
      ],
      0,
      saleContext
    );

    expect(fullReturn.refundAmount).toBe(297.44);
    expect(fullReturn.subtotal).toBe(275.0);
    expect(fullReturn.totalTax).toBe(22.44);
    expect(round2(fullReturn.subtotal + fullReturn.totalTax)).toBe(297.44);

    // 2. Sequential partial returns of each item
    // Return 1: Grape Coke (2 units)
    const ret1 = calculateReturnSummary(originalItems, [{ productId: 'p-grape', quantity: 2 }], 0, saleContext);
    expect(ret1.refundAmount).toBe(139.09); // 124.19 taxable + 14.90 tax = 139.09

    saleContext.pastReturns = [
      {
        items: [{ productId: 'p-grape', productName: 'Grape Coke', quantity: 2, refundAmount: ret1.refundAmount }],
        refundAmount: ret1.refundAmount,
      },
    ];

    // Return 2: Vanilla Coke (1 unit)
    const ret2 = calculateReturnSummary(originalItems, [{ productId: 'p-vanilla', quantity: 1 }], 0, saleContext);
    expect(ret2.refundAmount).toBe(139.71); // 133.06 taxable + 6.65 tax = 139.71

    saleContext.pastReturns.push({
      items: [{ productId: 'p-vanilla', productName: 'Vanilla Coke', quantity: 1, refundAmount: ret2.refundAmount }],
      refundAmount: ret2.refundAmount,
    });

    // Return 3: Slice (1 unit - final return)
    const ret3 = calculateReturnSummary(originalItems, [{ productId: 'p-slice', quantity: 1 }], 0, saleContext);

    // Total of all 3 sequential returns must equal EXACTLY ₹297.44
    const cumulativeTotal = round2(ret1.refundAmount + ret2.refundAmount + ret3.refundAmount);
    expect(cumulativeTotal).toBe(297.44);
  });

  // =========================================================================
  // INTEGRATION TEST: P&L METRICS WITH ACCURATE RETURN VALUES
  // =========================================================================
  it('correctly feeds returns into unified P&L metrics', () => {
    const pl = computePLMetrics({
      grossBilled: 118000,
      taxCollected: 16200,
      returnsDeducted: 10000,
      totalCost: 50000,
      totalExpenses: 15000,
    });

    expect(pl.netRevenue).toBe(91800);
    expect(pl.grossProfit).toBe(41800);
    expect(pl.netProfit).toBe(26800);
    expect(pl.returnsDeducted).toBe(10000);
  });
});
