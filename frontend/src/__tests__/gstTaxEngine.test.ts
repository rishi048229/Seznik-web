import { describe, it, expect } from 'vitest';
import {
  calculateGstBill,
  round2,
  VALID_GST_SLABS,
  isValidGstSlab,
  type BillInput,
  type LineItemInput,
} from '@shared/gstTaxEngine';

describe('GST-Compliant Tax and Discount Calculation Engine (Section 15 CGST Act)', () => {
  it('validates standard Indian GST slabs correctly', () => {
    expect(VALID_GST_SLABS).toEqual([0, 5, 12, 18, 28, 40]);
    expect(isValidGstSlab(0)).toBe(true);
    expect(isValidGstSlab(5)).toBe(true);
    expect(isValidGstSlab(12)).toBe(true);
    expect(isValidGstSlab(18)).toBe(true);
    expect(isValidGstSlab(28)).toBe(true);
    expect(isValidGstSlab(40)).toBe(true);
    expect(isValidGstSlab(7)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 1. Exclusive items only
  // -------------------------------------------------------------------------
  it('calculates tax for exclusive items accurately (Intra-State)', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Exclusive Item A',
          price: 100,
          qty: 2,
          gstRate: 18,
          priceType: 'exclusive',
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.documentType).toBe('Tax Invoice');
    expect(result.lines[0].lineTaxableGross).toBe(200);
    expect(result.lines[0].lineTaxableValue).toBe(200);
    expect(result.lines[0].lineGstAmount).toBe(36);
    expect(result.lines[0].cgstRate).toBe(9);
    expect(result.lines[0].cgstAmount).toBe(18);
    expect(result.lines[0].sgstRate).toBe(9);
    expect(result.lines[0].sgstAmount).toBe(18);
    expect(result.lines[0].igstAmount).toBe(0);
    expect(result.lines[0].lineFinalAmount).toBe(236);

    expect(result.totalTaxableValue).toBe(200);
    expect(result.totalCgst).toBe(18);
    expect(result.totalSgst).toBe(18);
    expect(result.totalTax).toBe(36);
    expect(result.finalInvoiceTotal).toBe(236);
  });

  // -------------------------------------------------------------------------
  // 2. Inclusive items only
  // -------------------------------------------------------------------------
  it('normalizes inclusive items to taxable base before tax calculation', () => {
    // ₹118 MRP with 18% GST => unit taxable base is 100
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Inclusive Item B',
          price: 118,
          qty: 2,
          gstRate: 18,
          priceType: 'inclusive',
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].unitTaxableValue).toBeCloseTo(100, 5);
    expect(result.lines[0].lineTaxableGross).toBeCloseTo(200, 5);
    expect(result.lines[0].lineTaxableValue).toBeCloseTo(200, 5);
    expect(result.lines[0].lineGstAmount).toBeCloseTo(36, 5);
    expect(result.lines[0].cgstAmount).toBeCloseTo(18, 5);
    expect(result.lines[0].sgstAmount).toBeCloseTo(18, 5);
    expect(result.lines[0].lineFinalAmount).toBeCloseTo(236, 5);

    expect(result.totalTaxableValue).toBe(200);
    expect(result.totalTax).toBe(36);
    expect(result.finalInvoiceTotal).toBe(236);
  });

  // -------------------------------------------------------------------------
  // 3. Mixed bill: some items inclusive, some exclusive in the same bill
  // -------------------------------------------------------------------------
  it('handles mixed inclusive and exclusive items by normalizing taxable value first', () => {
    const bill: BillInput = {
      lineItems: [
        // Exclusive ₹100 @ 18% => Taxable 100, GST 18
        {
          name: 'Exclusive Item',
          price: 100,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
        },
        // Inclusive ₹105 @ 5% => Taxable 100, GST 5
        {
          name: 'Inclusive Item',
          price: 105,
          qty: 1,
          gstRate: 5,
          priceType: 'inclusive',
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].lineTaxableValue).toBe(100);
    expect(result.lines[0].lineGstAmount).toBe(18);
    expect(result.lines[1].lineTaxableValue).toBe(100);
    expect(result.lines[1].lineGstAmount).toBe(5);

    expect(result.totalTaxableValue).toBe(200);
    expect(result.totalCgst).toBe(11.5); // (9 + 2.5)
    expect(result.totalSgst).toBe(11.5); // (9 + 2.5)
    expect(result.totalTax).toBe(23);
    expect(result.finalInvoiceTotal).toBe(223);

    // Check rate-wise summary has 2 buckets: 5% and 18%
    expect(result.rateWiseSummary.length).toBe(2);
    expect(result.rateWiseSummary[0].rate).toBe(5);
    expect(result.rateWiseSummary[0].totalTaxableValue).toBe(100);
    expect(result.rateWiseSummary[0].totalGst).toBe(5);

    expect(result.rateWiseSummary[1].rate).toBe(18);
    expect(result.rateWiseSummary[1].totalTaxableValue).toBe(100);
    expect(result.rateWiseSummary[1].totalGst).toBe(18);
  });

  // -------------------------------------------------------------------------
  // 4. Item discount only (no bill discount)
  // -------------------------------------------------------------------------
  it('applies item-level discount directly to taxable gross and calculates GST on net', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Discounted Item',
          price: 200,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
          itemDiscountAmount: 50, // ₹50 off on ₹200 taxable value
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    // Net taxable value = 200 - 50 = 150
    // GST @ 18% on 150 = 27 (CGST 13.50, SGST 13.50)
    expect(result.lines[0].lineTaxableGross).toBe(200);
    expect(result.lines[0].itemDiscountAmount).toBe(50);
    expect(result.lines[0].lineTaxableValue).toBe(150);
    expect(result.lines[0].lineGstAmount).toBe(27);
    expect(result.lines[0].cgstAmount).toBe(13.5);
    expect(result.lines[0].sgstAmount).toBe(13.5);

    expect(result.totalItemDiscounts).toBe(50);
    expect(result.totalTaxableValue).toBe(150);
    expect(result.totalTax).toBe(27);
    expect(result.finalInvoiceTotal).toBe(177);
  });

  // -------------------------------------------------------------------------
  // 5. Bill discount only (no item discount)
  // -------------------------------------------------------------------------
  it('apportions bill-level discount by value-weight across lines with different GST rates', () => {
    // Line 1: ₹300 @ 18% GST (Exclusive)
    // Line 2: ₹100 @ 5% GST (Exclusive)
    // Total taxable net = 400
    // Bill discount = ₹40 (10% flat)
    // Line 1 share = 300/400 (75%) => ₹30 discount => net taxable 270 => GST 18% of 270 = 48.60
    // Line 2 share = 100/400 (25%) => ₹10 discount => net taxable 90 => GST 5% of 90 = 4.50
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Item High Rate',
          price: 300,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
        },
        {
          name: 'Item Low Rate',
          price: 100,
          qty: 1,
          gstRate: 5,
          priceType: 'exclusive',
        },
      ],
      billDiscountAmount: 40,
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].lineShareOfBill).toBe(0.75);
    expect(result.lines[0].lineBillDiscount).toBe(30);
    expect(result.lines[0].lineTaxableValue).toBe(270);
    expect(result.lines[0].lineGstAmount).toBe(48.6);
    expect(result.lines[0].cgstAmount).toBe(24.3);
    expect(result.lines[0].sgstAmount).toBe(24.3);

    expect(result.lines[1].lineShareOfBill).toBe(0.25);
    expect(result.lines[1].lineBillDiscount).toBe(10);
    expect(result.lines[1].lineTaxableValue).toBe(90);
    expect(result.lines[1].lineGstAmount).toBe(4.5);
    expect(result.lines[1].cgstAmount).toBe(2.25);
    expect(result.lines[1].sgstAmount).toBe(2.25);

    expect(result.totalBillDiscount).toBe(40);
    expect(result.totalTaxableValue).toBe(360);
    expect(result.totalCgst).toBe(26.55); // 24.30 + 2.25
    expect(result.totalSgst).toBe(26.55);
    expect(result.totalTax).toBe(53.1);
    expect(result.rawInvoiceTotal).toBe(413.1);
    expect(result.roundOff).toBe(-0.1); // 413.00 - 413.10
    expect(result.finalInvoiceTotal).toBe(413);
  });

  // -------------------------------------------------------------------------
  // 6. Both item discount AND bill discount on same bill
  // -------------------------------------------------------------------------
  it('applies item discount first, then apportions bill discount over already-discounted net taxable values', () => {
    // Line 1: Gross 200, item discount 50 => net 150
    // Line 2: Gross 150, item discount 0 => net 150
    // Total net after item discounts = 300
    // Bill discount = ₹30 (10% of 300)
    // Line 1 bill discount share = 150/300 * 30 = 15 => final taxable 135
    // Line 2 bill discount share = 150/300 * 30 = 15 => final taxable 135
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Item 1',
          price: 200,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
          itemDiscountAmount: 50,
        },
        {
          name: 'Item 2',
          price: 150,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
        },
      ],
      billDiscountAmount: 30,
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].lineNetAfterItemDiscount).toBe(150);
    expect(result.lines[0].lineBillDiscount).toBe(15);
    expect(result.lines[0].lineTaxableValue).toBe(135);

    expect(result.lines[1].lineNetAfterItemDiscount).toBe(150);
    expect(result.lines[1].lineBillDiscount).toBe(15);
    expect(result.lines[1].lineTaxableValue).toBe(135);

    expect(result.totalGrossTaxable).toBe(350);
    expect(result.totalItemDiscounts).toBe(50);
    expect(result.totalBillDiscount).toBe(30);
    expect(result.totalDiscounts).toBe(80);
    expect(result.totalTaxableValue).toBe(270);
    expect(result.totalTax).toBe(48.6); // 18% of 270
  });

  // -------------------------------------------------------------------------
  // 7. Negative-Value Guard
  // -------------------------------------------------------------------------
  it('floors taxable value at 0 and adds warnings when combined discount exceeds item value', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Over-discounted item',
          price: 100,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
          itemDiscountAmount: 150, // exceeds ₹100
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].isCappedAtZero).toBe(true);
    expect(result.lines[0].lineTaxableValue).toBe(0);
    expect(result.lines[0].lineGstAmount).toBe(0);
    expect(result.totalTaxableValue).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.finalInvoiceTotal).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. BOGO (Buy 1 Get 1 Free) Modeling
  // -------------------------------------------------------------------------
  it('models BOGO as 50% discount on combined 2-unit taxable base without zero-pricing units', () => {
    // 2 units at ₹100 each = ₹200 taxable gross
    // BOGO gives 50% discount on ₹200 = ₹100 discount
    // Final taxable = ₹100, GST @ 18% = ₹18, Final amount = ₹118
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Shirt (Buy 1 Get 1 Free)',
          price: 100,
          qty: 2,
          gstRate: 18,
          priceType: 'exclusive',
          isBogo: true,
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].lineTaxableGross).toBe(200);
    expect(result.lines[0].itemDiscountAmount).toBe(100);
    expect(result.lines[0].lineTaxableValue).toBe(100);
    expect(result.lines[0].lineGstAmount).toBe(18);
    expect(result.finalInvoiceTotal).toBe(118);
  });

  // -------------------------------------------------------------------------
  // 9. Inter-State vs Intra-State (IGST vs CGST/SGST)
  // -------------------------------------------------------------------------
  it('applies IGST for Inter-State transactions (isIntraState = false)', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Interstate Machine',
          price: 1000,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
        },
      ],
      isIntraState: false,
    };

    const result = calculateGstBill(bill);
    expect(result.isIntraState).toBe(false);
    expect(result.lines[0].cgstAmount).toBe(0);
    expect(result.lines[0].sgstAmount).toBe(0);
    expect(result.lines[0].igstRate).toBe(18);
    expect(result.lines[0].igstAmount).toBe(180);
    expect(result.totalCgst).toBe(0);
    expect(result.totalSgst).toBe(0);
    expect(result.totalIgst).toBe(180);
    expect(result.totalTax).toBe(180);
    expect(result.rateWiseSummary[0].totalIgst).toBe(180);
  });

  // -------------------------------------------------------------------------
  // 10. Composition Scheme Sellers ("Bill of Supply")
  // -------------------------------------------------------------------------
  it('outputs Bill of Supply and suppresses all GST fields for Composition Scheme sellers', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Composition Item',
          price: 100,
          qty: 2,
          gstRate: 5,
          priceType: 'exclusive',
          itemDiscountAmount: 20,
        },
      ],
      isCompositionScheme: true,
    };

    const result = calculateGstBill(bill);
    expect(result.documentType).toBe('Bill of Supply');
    expect(result.isCompositionScheme).toBe(true);
    expect(result.totalGrossTaxable).toBe(200);
    expect(result.totalItemDiscounts).toBe(20);
    expect(result.totalTaxableValue).toBe(180);
    // GST must be suppressed
    expect(result.totalCgst).toBe(0);
    expect(result.totalSgst).toBe(0);
    expect(result.totalIgst).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.lines[0].lineGstAmount).toBe(0);
    expect(result.finalInvoiceTotal).toBe(180);
  });

  // -------------------------------------------------------------------------
  // 11. Reciprocal Obligation & Post-Sale Rebate Exclusion Compliance
  // -------------------------------------------------------------------------
  it('excludes discounts with reciprocal obligations or post-sale rebate from Section 15 price reduction', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Item with Marketing Co-op Promo',
          price: 100,
          qty: 1,
          gstRate: 18,
          priceType: 'exclusive',
          itemDiscountAmount: 30,
          discountMetadata: {
            hasReciprocalObligation: true, // buyer performs advertising
          },
        },
      ],
      billDiscountAmount: 20,
      billDiscountMetadata: {
        isPostSaleRebate: true, // scheme rebate issued later
      },
    };

    const result = calculateGstBill(bill);
    // Both discounts should be excluded from reducing taxable value under Section 15
    expect(result.lines[0].itemDiscountAmount).toBe(0);
    expect(result.lines[0].lineBillDiscount).toBe(0);
    expect(result.lines[0].lineTaxableValue).toBe(100);
    expect(result.lines[0].lineGstAmount).toBe(18);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // 12. 40% GST Slab Support
  // -------------------------------------------------------------------------
  it('handles the newly introduced 40% GST slab seamlessly', () => {
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Luxury / Sin Good',
          price: 500,
          qty: 1,
          gstRate: 40,
          priceType: 'exclusive',
        },
      ],
      isIntraState: true,
    };

    const result = calculateGstBill(bill);
    expect(result.lines[0].cgstRate).toBe(20);
    expect(result.lines[0].sgstRate).toBe(20);
    expect(result.lines[0].cgstAmount).toBe(100);
    expect(result.lines[0].sgstAmount).toBe(100);
    expect(result.lines[0].lineGstAmount).toBe(200);
    expect(result.totalTax).toBe(200);
    expect(result.finalInvoiceTotal).toBe(700);
  });

  // -------------------------------------------------------------------------
  // 13. Multi-Rate Bill-Level Discount Precision (1-Paisa Rounding Bug Fix)
  // -------------------------------------------------------------------------
  it('prevents 1-paisa rounding drift on multi-rate carts with bill-level discount (Grand total ₹297.44, not ₹297.43)', () => {
    // Scenario:
    // Grape Coke: 2 units @ ₹70 (12% GST) -> ₹140 taxable, ₹16.80 GST
    // Vanilla Coke: 1 unit @ ₹150 (5% GST) -> ₹150 taxable, ₹7.50 GST
    // Slice: 1 unit @ ₹20 (5% GST) -> ₹20 taxable, ₹1.00 GST
    // Pre-discount total = ₹335.30 (Taxable ₹310, Tax ₹25.30)
    // Flat Bill Discount = ₹35.00
    //
    // True unrounded precision:
    // Grape Coke (12%): Taxable = 140 - 35 * (140/310) = 124.193548... | GST = 14.9032258...
    // Vanilla Coke (5%): Taxable = 150 - 35 * (150/310) = 133.064516... | GST = 6.6532258...
    // Slice (5%): Taxable = 20 - 35 * (20/310) = 17.7419354... | GST = 0.8870967...
    //
    // Sum of Unrounded Taxable = 275.00
    // Sum of Unrounded GST = 22.443548... -> rounds to 22.44
    // True Grand Total = 297.443548... -> rounds to 297.44 (NOT 297.43)
    const bill: BillInput = {
      lineItems: [
        {
          name: 'Grape Coke',
          price: 70,
          qty: 2,
          gstRate: 12,
          priceType: 'exclusive',
        },
        {
          name: 'Vanilla Coke',
          price: 150,
          qty: 1,
          gstRate: 5,
          priceType: 'exclusive',
        },
        {
          name: 'Slice',
          price: 20,
          qty: 1,
          gstRate: 5,
          priceType: 'exclusive',
        },
      ],
      billDiscountAmount: 35,
      isIntraState: true,
      roundingMode: 'none',
    };

    const result = calculateGstBill(bill);

    // Assert pre-discount gross taxable
    expect(result.totalGrossTaxable).toBe(310.0);
    expect(result.totalBillDiscount).toBe(35.0);
    expect(result.totalTaxableValue).toBe(275.0);

    // Assert unrounded sums carried through to final total
    expect(result.unroundedTotalTax).toBeCloseTo(22.443548, 5);
    expect(result.totalTax).toBe(22.44);

    // Critical assertion: Grand total is exactly ₹297.44, NOT ₹297.43
    expect(result.rawInvoiceTotal).toBe(297.44);
    expect(result.finalInvoiceTotal).toBe(297.44);

    // Line display values (rounded individually for tabular display)
    expect(result.lines[0].lineTaxableValue).toBe(124.19);
    expect(result.lines[0].lineGstAmount).toBe(14.9);
    expect(result.lines[1].lineTaxableValue).toBe(133.06);
    expect(result.lines[1].lineGstAmount).toBe(6.65);
    expect(result.lines[2].lineTaxableValue).toBe(17.74);
    expect(result.lines[2].lineGstAmount).toBe(0.89);

    // Rate-wise summary buckets with unrounded precision
    expect(result.rateWiseSummary.length).toBe(2);
    // 5% slab (Vanilla Coke + Slice): 133.064516... + 17.7419354... = 150.80645... -> 150.81 taxable, 7.54 GST
    const slab5 = result.rateWiseSummary.find((b) => b.rate === 5);
    expect(slab5).toBeDefined();
    expect(slab5?.totalTaxableValue).toBe(150.81);
    expect(slab5?.totalGst).toBe(7.54);

    // 12% slab (Grape Coke): 124.19 taxable, 14.90 GST
    const slab12 = result.rateWiseSummary.find((b) => b.rate === 12);
    expect(slab12).toBeDefined();
    expect(slab12?.totalTaxableValue).toBe(124.19);
    expect(slab12?.totalGst).toBe(14.9);
  });
});
