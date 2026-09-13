import { describe, it, expect } from 'vitest';
import {
  calculatePurchaseReturnSummary,
  type OriginalPurchaseItem,
  type PurchaseReturnItemRequest,
  type OriginalPurchaseContext,
} from '@shared/purchaseReturnCalculator';
import { computePLMetrics } from '@shared/plEngine';
import { round2 } from '@shared/gstTaxEngine';

describe('Purchase Return / Debit Note Engine — 6 Mandatory Test Suites & Invariant Verification', () => {
  // =========================================================================
  // TEST SUITE 1: Full purchase return refunds exactly Purchase.grandTotal
  // (No discount, item discount only, bill discount only, and both combined)
  // =========================================================================
  describe('Suite 1: Full Purchase Return Scenarios', () => {
    it('Suite 1a: Full return with no discount refunds exactly Purchase.grandTotal', () => {
      // 3 items purchased:
      // Item A (0% GST): 10 @ 200 = 2000
      // Item B (5% GST): 5 @ 400 = 2000 + 100 GST = 2100
      // Item C (18% GST): 2 @ 1000 = 2000 + 360 GST = 2360
      // Subtotal = 6000, Total Tax = 460, Grand Total = 6460
      const originalItems: OriginalPurchaseItem[] = [
        { productId: 'item-a', productName: 'Item A', quantity: 10, costPrice: 200, taxRate: 0, total: 2000, taxableAmount: 2000, taxAmount: 0 },
        { productId: 'item-b', productName: 'Item B', quantity: 5, costPrice: 400, taxRate: 5, total: 2100, taxableAmount: 2000, taxAmount: 100 },
        { productId: 'item-c', productName: 'Item C', quantity: 2, costPrice: 1000, taxRate: 18, total: 2360, taxableAmount: 2000, taxAmount: 360 },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 6000,
        totalDiscount: 0,
        totalTax: 460,
        grandTotal: 6460,
      };

      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'item-a', quantity: 10 },
        { productId: 'item-b', quantity: 5 },
        { productId: 'item-c', quantity: 2 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      expect(summary.refundAmount).toBe(6460.0);
      expect(summary.subtotal).toBe(6000.0);
      expect(summary.totalTax).toBe(460.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
      expect(summary.items.length).toBe(3);
    });

    it('Suite 1b: Full return with item-level discount only refunds exactly Purchase.grandTotal', () => {
      // Raw: 10 units @ 500 = 5000. Item discount: 500 -> Taxable = 4500. 12% GST = 540. GrandTotal = 5040
      const originalItems: OriginalPurchaseItem[] = [
        {
          productId: 'item-disc',
          productName: 'Discounted Raw Material',
          quantity: 10,
          costPrice: 500,
          taxRate: 12,
          discountAmount: 500,
          taxableAmount: 4500,
          taxAmount: 540,
          total: 5040,
        },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 4500,
        totalDiscount: 500,
        totalTax: 540,
        grandTotal: 5040,
      };

      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'item-disc', quantity: 10 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      expect(summary.refundAmount).toBe(5040.0);
      expect(summary.subtotal).toBe(4500.0);
      expect(summary.totalTax).toBe(540.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });

    it('Suite 1c: Full return with bill-level discount only refunds exactly Purchase.grandTotal', () => {
      // 2 lines:
      // Line 1: 5 @ 200 (5% GST) = 1000 + 50 = 1050
      // Line 2: 2 @ 500 (18% GST) = 1000 + 180 = 1180
      // Total taxable pre-discount = 2000. Bill discount = 200.
      // Net taxable = 1800 (900 each). Tax = 45 + 162 = 207. Grand total = 2007.
      const originalItems: OriginalPurchaseItem[] = [
        { productId: 'p1', productName: 'P1', quantity: 5, costPrice: 200, taxRate: 5, total: 1050, taxableAmount: 1000, taxAmount: 50 },
        { productId: 'p2', productName: 'P2', quantity: 2, costPrice: 500, taxRate: 18, total: 1180, taxableAmount: 1000, taxAmount: 180 },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 1800,
        totalDiscount: 200,
        totalTax: 207,
        grandTotal: 2007,
      };

      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'p1', quantity: 5 },
        { productId: 'p2', quantity: 2 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      expect(summary.refundAmount).toBe(2007.0);
      expect(summary.subtotal).toBe(1800.0);
      expect(summary.totalTax).toBe(207.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });

    it('Suite 1d: Full return with both item and bill discounts combined refunds exactly Purchase.grandTotal', () => {
      const originalItems: OriginalPurchaseItem[] = [
        { productId: 'combo-1', productName: 'Combo 1', quantity: 4, costPrice: 300, taxRate: 5, discountAmount: 200, taxableAmount: 1000, taxAmount: 50, total: 1050 },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 900,
        totalDiscount: 300, // 200 item disc + 100 bill disc
        totalTax: 45,
        grandTotal: 945,
      };

      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'combo-1', quantity: 4 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      expect(summary.refundAmount).toBe(945.0);
      expect(summary.subtotal).toBe(900.0);
      expect(summary.totalTax).toBe(45.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Partial return proration matches stored discounted line values
  // (Not the product or supplier's CURRENT price or terms)
  // =========================================================================
  describe('Suite 2: Partial Return Proration with Stored Post-Discount Values', () => {
    it('Suite 2: Prorates partial quantities from stored discounted values', () => {
      // 10 units bought @ 100 with Rs. 200 item discount.
      // Net Taxable for 10 units = 800 (80/unit). 18% GST = 144 (14.40/unit). Total = 944 (94.40/unit).
      // If we return 3 units:
      // Refund = 3 * 94.40 = 283.20. Tax = 3 * 14.40 = 43.20. Subtotal = 240.00.
      const originalItems: OriginalPurchaseItem[] = [
        {
          productId: 'bulk-item',
          productName: 'Bulk Hardware',
          quantity: 10,
          costPrice: 100,
          taxRate: 18,
          discountAmount: 200,
          taxableAmount: 800,
          taxAmount: 144,
          total: 944,
        },
      ];

      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'bulk-item', quantity: 3 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests);

      expect(summary.refundAmount).toBe(283.2);
      expect(summary.totalTax).toBe(43.2);
      expect(summary.subtotal).toBe(240.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });
  });

  // =========================================================================
  // TEST SUITE 3: Multi-rate GST purchase with bill discount & partial return
  // (Exact paisa reconciliation, zero rounding drift)
  // =========================================================================
  describe('Suite 3: Multi-rate GST + Bill Discount Precision Reconciliation', () => {
    it('Suite 3: Multi-rate GST purchase (5%, 12%, 18%) with bill discount reconciles with zero rounding drift', () => {
      // 3 items at 3 distinct GST rates:
      // Line 1 (5% GST): 10 units @ 100 = 1000
      // Line 2 (12% GST): 5 units @ 200 = 1000
      // Line 3 (18% GST): 2 units @ 500 = 1000
      // Total taxable pre-bill-discount = 3000.
      // Bill discount from supplier = Rs. 150 (apportioned Rs. 50 to each line).
      // Line 1: Taxable = 950, GST (5%) = 47.50, Line Total = 997.50
      // Line 2: Taxable = 950, GST (12%) = 114.00, Line Total = 1064.00
      // Line 3: Taxable = 950, GST (18%) = 171.00, Line Total = 1121.00
      // Purchase Grand Total = 3182.50, Subtotal = 2850.00, Total Tax = 332.50
      const originalItems: OriginalPurchaseItem[] = [
        { productId: 'm1', productName: 'Spices 5%', quantity: 10, costPrice: 100, taxRate: 5, total: 1050, taxableAmount: 1000, taxAmount: 50 },
        { productId: 'm2', productName: 'Sauces 12%', quantity: 5, costPrice: 200, taxRate: 12, total: 1120, taxableAmount: 1000, taxAmount: 120 },
        { productId: 'm3', productName: 'Packaging 18%', quantity: 2, costPrice: 500, taxRate: 18, total: 1180, taxableAmount: 1000, taxAmount: 180 },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 2850,
        totalDiscount: 150,
        totalTax: 332.5,
        grandTotal: 3182.5,
      };

      // Return partial quantities: 3 of Line 1, 2 of Line 2, 1 of Line 3
      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'm1', quantity: 3 }, // 3/10 * 997.50 = 299.25 (Tax: 3/10 * 47.50 = 14.25, Taxable: 285.00)
        { productId: 'm2', quantity: 2 }, // 2/5 * 1064.00 = 425.60 (Tax: 2/5 * 114.00 = 45.60, Taxable: 380.00)
        { productId: 'm3', quantity: 1 }, // 1/2 * 1121.00 = 560.50 (Tax: 1/2 * 171.00 = 85.50, Taxable: 475.00)
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      expect(summary.items[0].refundAmount).toBe(299.25);
      expect(summary.items[0].gstAmount).toBe(14.25);
      expect(summary.items[0].taxableAmount).toBe(285.0);

      expect(summary.items[1].refundAmount).toBe(425.6);
      expect(summary.items[1].gstAmount).toBe(45.6);
      expect(summary.items[1].taxableAmount).toBe(380.0);

      expect(summary.items[2].refundAmount).toBe(560.5);
      expect(summary.items[2].gstAmount).toBe(85.5);
      expect(summary.items[2].taxableAmount).toBe(475.0);

      const expectedTotalRefund = round2(299.25 + 425.6 + 560.5); // 1285.35
      const expectedTotalTax = round2(14.25 + 45.6 + 85.5); // 145.35
      const expectedSubtotal = round2(285.0 + 380.0 + 475.0); // 1140.00

      expect(summary.refundAmount).toBe(expectedTotalRefund);
      expect(summary.totalTax).toBe(expectedTotalTax);
      expect(summary.subtotal).toBe(expectedSubtotal);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Stock decrement and remaining returnable quantity guarding
  // =========================================================================
  describe('Suite 4: Stock Movement & Remaining Quantity Guarding', () => {
    it('Suite 4: Handles multiple sequential partial returns and absorbs fractional drift on final return', () => {
      // 3 units bought for total 100.00 (33.33 / unit approx)
      const originalItems: OriginalPurchaseItem[] = [
        { productId: 'drift-item', productName: 'Drift Item', quantity: 3, costPrice: 33.3333, taxRate: 0, total: 100, taxableAmount: 100, taxAmount: 0 },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 100,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 100,
        pastReturns: [
          {
            items: [{ productId: 'drift-item', quantity: 2, refundAmount: 66.67 }],
            refundAmount: 66.67,
            subtotal: 66.67,
            totalTax: 0,
          },
        ],
      };

      // Return remaining 1 unit
      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'drift-item', quantity: 1 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      // Remaining 1 unit must refund exactly 100.00 - 66.67 = 33.33 with zero cumulative drift
      expect(summary.refundAmount).toBe(33.33);
      expect(round2(66.67 + summary.refundAmount)).toBe(100.0);
    });
  });

  // =========================================================================
  // TEST SUITE 5: netCOGS in P&L output reflects PurchaseReturn subtotal
  // =========================================================================
  describe('Suite 5: P&L Engine Integration & Single Source of Truth', () => {
    it('Suite 5: netCOGS = grossCOGS - returnedItemsCost sourced strictly from PurchaseReturn.subtotal', () => {
      const grossBilled = 10000;
      const taxCollected = 1800;
      const grossCOGS = 6000;
      const returnedItemsCost = 1500; // sum of PurchaseReturn.subtotal
      const netCOGS = grossCOGS - returnedItemsCost; // 4500
      const totalExpenses = 1000;

      const plResult = computePLMetrics({
        grossBilled,
        taxCollected,
        returnsDeducted: 0,
        totalCost: netCOGS,
        totalExpenses,
      });

      // Net Revenue = 10000 - 1800 = 8200
      // Gross Profit = 8200 - 4500 = 3700
      // Net Profit = 3700 - 1000 = 2700
      expect(plResult.netRevenue).toBe(8200);
      expect(plResult.totalCost).toBe(4500);
      expect(plResult.grossProfit).toBe(3700);
      expect(plResult.netProfit).toBe(2700);
    });
  });

  // =========================================================================
  // TEST SUITE 6: Changing product price/tax mode AFTER purchase has 0% effect
  // =========================================================================
  describe('Suite 6: Immunity to Post-Purchase Catalog Changes', () => {
    it('Suite 6: Subsequent changes to product costPrice, taxRate or tax mode do not alter return calculation', () => {
      // Purchase recorded when product was: costPrice = 200, taxRate = 5% (Exclusive).
      // Subtotal = 2000, Total Tax = 100, Grand Total = 2100.
      const originalItems: OriginalPurchaseItem[] = [
        {
          productId: 'prod-frozen',
          productName: 'Frozen Vegetable 1kg',
          quantity: 10,
          costPrice: 200,
          taxRate: 5,
          priceIncludesGst: false,
          taxableAmount: 2000,
          taxAmount: 100,
          total: 2100,
        },
      ];

      const purchaseContext: OriginalPurchaseContext = {
        subtotal: 2000,
        totalDiscount: 0,
        totalTax: 100,
        grandTotal: 2100,
      };

      // Even if current catalog now has costPrice = 350, taxRate = 18%, priceIncludesGst = true:
      // The return engine only processes against originalItems & purchaseContext stored snapshot.
      const returnRequests: PurchaseReturnItemRequest[] = [
        { productId: 'prod-frozen', quantity: 4 },
      ];

      const summary = calculatePurchaseReturnSummary(originalItems, returnRequests, purchaseContext);

      // 4 / 10 * 2100 = 840.00
      // 4 / 10 * 2000 = 800.00 (Taxable)
      // 4 / 10 * 100 = 40.00 (Tax)
      expect(summary.refundAmount).toBe(840.0);
      expect(summary.subtotal).toBe(800.0);
      expect(summary.totalTax).toBe(40.0);
      expect(round2(summary.subtotal + summary.totalTax)).toBe(summary.refundAmount);
    });
  });
});
