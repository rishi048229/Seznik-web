/**
 * GST-Compliant Tax & Discount Calculation Engine
 * Legally compliant with Section 15 of the Central Goods and Services Tax (CGST) Act, 2017.
 *
 * CORE PRINCIPLES:
 * 1. GST is always calculated on (Taxable Value − Discount), never on the original inclusive price.
 * 2. Discounts applied at or before invoicing directly reduce the taxable value when appearing on the invoice.
 * 3. Apportionment of bill-level discounts is value-weighted across normalized taxable values of all lines.
 * 4. Rate-wise summary grouping is based solely on gstRate (no HSN coupling).
 * 5. Single-pass rounding per tax component with residual round-off absorption.
 * 6. Supports Composition Scheme ("Bill of Supply") and BOGO models.
 */

export type PriceType = 'inclusive' | 'exclusive';

/** Standard Indian GST rate slabs (0%, 5%, 12%, 18%, 28%, 40%) */
export const VALID_GST_SLABS = [0, 5, 12, 18, 28, 40] as const;
export type ValidGstSlab = typeof VALID_GST_SLABS[number];

export interface DiscountMetadata {
  /** Type of discount being applied */
  type?: 'item_discount' | 'bill_discount' | 'coupon' | 'bogo' | 'custom';
  /**
   * Section 15(2) Compliance: If a discount requires the buyer to perform an action
   * (e.g., advertisement, promotional display, marketing service), it represents a separate
   * taxable consideration/service rather than a price discount.
   */
  hasReciprocalObligation?: boolean;
  /**
   * Post-sale rebates or loyalty payouts granted after invoice issuance are out of scope
   * for pre-supply invoice discount under Section 15(3)(a).
   */
  isPostSaleRebate?: boolean;
  /** Optional discount description or coupon code */
  codeOrDescription?: string;
}

export interface LineItemInput {
  /** Optional line identifier or product name */
  id?: string;
  name?: string;
  /** Unit price entered by the user */
  price: number;
  /** Quantity billed */
  qty: number;
  /** GST rate percentage (e.g. 0, 5, 12, 18, 28, 40) */
  gstRate: number;
  /** "inclusive" (MRP/tax-inclusive) or "exclusive" (base price + tax) */
  priceType: PriceType;
  /** Pre-configured flat item discount amount (in currency) */
  itemDiscountAmount?: number;
  /** Pre-configured item discount percentage (e.g. 10 for 10% off line taxable gross) */
  itemDiscountPercent?: number;
  /** Buy 1 Get 1 (BOGO) flag: models % discount on multi-unit taxable value */
  isBogo?: boolean;
  /** BOGO discount percentage on the multi-unit line (default: 50% for 2 units) */
  bogoDiscountPercent?: number;
  /** Discount compliance metadata */
  discountMetadata?: DiscountMetadata;
}

export interface BillInput {
  lineItems: LineItemInput[];
  /** Optional flat bill-level discount amount */
  billDiscountAmount?: number;
  /** Optional percentage bill-level discount (e.g. 10 for 10% off total net taxable) */
  billDiscountPercent?: number;
  /** True for Intra-State (CGST + SGST split), false for Inter-State (IGST). Default: true */
  isIntraState?: boolean;
  /**
   * Composition Scheme seller flag:
   * When true, outputs "Bill of Supply" instead of "Tax Invoice" and suppresses GST breakdown.
   */
  isCompositionScheme?: boolean;
  /** Discount compliance metadata for bill-level discount */
  billDiscountMetadata?: DiscountMetadata;
  /** Rounding mode: 'nearest' integer rupee with round-off or 'none'. Default: 'nearest' */
  roundingMode?: 'nearest' | 'none';
}

export interface CalculatedLineItem {
  id?: string;
  name?: string;
  rawPrice: number;
  qty: number;
  priceType: PriceType;
  gstRate: number;

  // Step 1: Normalization to taxable base
  unitTaxableValue: number;
  lineTaxableGross: number;

  // Step 2: Item-level discount
  itemDiscountAmount: number;
  lineNetAfterItemDiscount: number;

  // Step 3: Value-weighted apportioned bill discount
  lineShareOfBill: number;
  lineBillDiscount: number;
  lineTaxableValue: number;

  // Step 4: GST per line
  lineGstAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;

  // Step 7: Final display line amount
  lineFinalAmount: number;

  // Flags & guards
  isCappedAtZero: boolean;
  warnings?: string[];
}

export interface RateWiseSummaryBucket {
  rate: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  lineCount: number;
}

export interface GstBillCalculationResult {
  documentType: 'Tax Invoice' | 'Bill of Supply';
  isCompositionScheme: boolean;
  isIntraState: boolean;

  // Line items
  lines: CalculatedLineItem[];

  // Bill-level taxable & discount totals (unrounded)
  totalGrossTaxable: number;
  totalItemDiscounts: number;
  totalBillDiscount: number;
  totalDiscounts: number;
  totalTaxableValue: number;

  // Tax component sums (unrounded exact vs final rounded)
  unroundedCgst: number;
  unroundedSgst: number;
  unroundedIgst: number;
  unroundedTotalTax: number;

  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;

  // Section 15 & GSTR-1 Rate-wise summary (grouped by gstRate only, no HSN)
  rateWiseSummary: RateWiseSummaryBucket[];

  // Final invoice amounts & round off
  rawInvoiceTotal: number;
  roundOff: number;
  finalInvoiceTotal: number;

  // Compliance validation status
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Utility: round a number to 2 decimal places (standard currency paise precision) */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/** Utility: round a number to 4 decimal places for high-precision intermediate shares */
export function round4(num: number): number {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

/** Validates whether a GST rate belongs to valid standard slabs (0, 5, 12, 18, 28, 40) */
export function isValidGstSlab(rate: number): boolean {
  return VALID_GST_SLABS.includes(rate as ValidGstSlab);
}

/**
 * Pure, testable calculation engine for Section 15 compliant GST billing.
 *
 * Execution follows the mandatory 7-step sequence:
 * 1. Normalize every line to taxable value based on priceType ("inclusive" vs "exclusive").
 * 2. Apply item-level pre-configured discount on taxable value.
 * 3. Apportion bill-level discount across lines by value-weight (lineNet / totalNet).
 * 4. Compute GST per line on final net lineTaxableValue (split CGST/SGST or IGST).
 * 5. Group lines by gstRate into rate-wise summary buckets.
 * 6. Perform single-pass rounding per tax component and compute residual round-off.
 * 7. Produce per-line final amounts with explicit priceType preservation for receipts.
 */
export function calculateGstBill(bill: BillInput): GstBillCalculationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isCompositionScheme = Boolean(bill.isCompositionScheme);
  const isIntraState = bill.isIntraState !== false; // default true (Intra-state)
  const roundingMode = bill.roundingMode ?? 'nearest';

  const rawLines = bill.lineItems || [];

  // Guard: Empty bill
  if (rawLines.length === 0) {
    return {
      documentType: isCompositionScheme ? 'Bill of Supply' : 'Tax Invoice',
      isCompositionScheme,
      isIntraState,
      lines: [],
      totalGrossTaxable: 0,
      totalItemDiscounts: 0,
      totalBillDiscount: 0,
      totalDiscounts: 0,
      totalTaxableValue: 0,
      unroundedCgst: 0,
      unroundedSgst: 0,
      unroundedIgst: 0,
      unroundedTotalTax: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalTax: 0,
      rateWiseSummary: [],
      rawInvoiceTotal: 0,
      roundOff: 0,
      finalInvoiceTotal: 0,
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  // Validate Bill-Level Discount Compliance
  if (bill.billDiscountMetadata?.hasReciprocalObligation) {
    warnings.push(
      'Bill discount has reciprocal promotional/service obligation: Excluded from Section 15 pre-supply discount (treat as separate service).'
    );
  }
  if (bill.billDiscountMetadata?.isPostSaleRebate) {
    warnings.push(
      'Bill discount flagged as post-sale rebate: Excluded from real-time invoice GST deduction under Section 15(3).'
    );
  }

  const allowBillDiscount =
    !bill.billDiscountMetadata?.hasReciprocalObligation &&
    !bill.billDiscountMetadata?.isPostSaleRebate;

  // =========================================================================
  // STEP 1 & STEP 2: Normalization and Item-Level Discount
  // =========================================================================
  interface IntermediateLine {
    raw: LineItemInput;
    unitTaxableValue: number;
    lineTaxableGross: number;
    itemDiscountAmount: number;
    lineNetAfterItemDiscount: number;
    isCappedAtZero: boolean;
    lineWarnings: string[];
  }

  const intermediateLines: IntermediateLine[] = rawLines.map((item, idx) => {
    const lineWarnings: string[] = [];
    const price = Math.max(0, Number(item.price) || 0);
    const qty = Math.max(0, Number(item.qty) || 0);
    const gstRate = Math.max(0, Number(item.gstRate) || 0);

    if (!isValidGstSlab(gstRate)) {
      lineWarnings.push(
        `Item "${item.name || idx + 1}" uses non-standard GST rate ${gstRate}%. Valid slabs: 0%, 5%, 12%, 18%, 28%, 40%.`
      );
    }

    // Step 1: Normalize to taxable value based on priceType
    let unitTaxableValue = 0;
    let lineTaxableGross = 0;

    if (item.priceType === 'inclusive') {
      unitTaxableValue = gstRate > 0 ? price / (1 + gstRate / 100) : price;
      lineTaxableGross = unitTaxableValue * qty;
    } else {
      // exclusive
      unitTaxableValue = price;
      lineTaxableGross = price * qty;
    }

    // Step 2: Apply item's own pre-configured discount (if any) on taxable value
    let calculatedItemDiscount = 0;

    // Check for Section 15 exclusion metadata
    const hasReciprocal = Boolean(item.discountMetadata?.hasReciprocalObligation);
    const isPostRebate = Boolean(item.discountMetadata?.isPostSaleRebate);

    if (hasReciprocal) {
      lineWarnings.push(
        `Item "${item.name || idx + 1}" discount has reciprocal promotional obligation: Excluded from Section 15 pre-supply discount.`
      );
    }
    if (isPostRebate) {
      lineWarnings.push(
        `Item "${item.name || idx + 1}" discount is a post-sale rebate: Excluded from invoice tax deduction.`
      );
    }

    const allowItemDiscount = !hasReciprocal && !isPostRebate;

    if (allowItemDiscount) {
      if (item.isBogo) {
        // BOGO Model: modeled as % discount on the combined multi-unit taxable value
        const bogoPercent = item.bogoDiscountPercent ?? 50;
        calculatedItemDiscount = (lineTaxableGross * bogoPercent) / 100;
      } else if (item.itemDiscountPercent !== undefined && item.itemDiscountPercent > 0) {
        calculatedItemDiscount = (lineTaxableGross * item.itemDiscountPercent) / 100;
      } else if (item.itemDiscountAmount !== undefined && item.itemDiscountAmount > 0) {
        // If discount amount was entered in inclusive terms for inclusive items, normalize it, otherwise use raw
        if (item.priceType === 'inclusive' && gstRate > 0) {
          calculatedItemDiscount = item.itemDiscountAmount / (1 + gstRate / 100);
        } else {
          calculatedItemDiscount = item.itemDiscountAmount;
        }
      }
    }

    let lineNetAfterItemDiscount = lineTaxableGross - calculatedItemDiscount;
    let isCappedAtZero = false;

    // Negative Value Guard: floor at zero if discount exceeds line value
    if (lineNetAfterItemDiscount < 0) {
      isCappedAtZero = true;
      lineWarnings.push(
        `Item "${item.name || idx + 1}" item discount (₹${calculatedItemDiscount.toFixed(
          2
        )}) exceeded gross taxable value (₹${lineTaxableGross.toFixed(2)}). Taxable floored at ₹0.00.`
      );
      calculatedItemDiscount = lineTaxableGross;
      lineNetAfterItemDiscount = 0;
    }

    return {
      raw: item,
      unitTaxableValue,
      lineTaxableGross,
      itemDiscountAmount: calculatedItemDiscount,
      lineNetAfterItemDiscount,
      isCappedAtZero,
      lineWarnings,
    };
  });

  // =========================================================================
  // STEP 3: Value-Weighted Bill-Level Discount Apportionment
  // =========================================================================
  const totalNetAfterItemDiscounts = intermediateLines.reduce(
    (sum, line) => sum + line.lineNetAfterItemDiscount,
    0
  );

  let effectiveBillDiscountAmount = 0;
  if (allowBillDiscount) {
    if (bill.billDiscountPercent !== undefined && bill.billDiscountPercent > 0) {
      effectiveBillDiscountAmount =
        (totalNetAfterItemDiscounts * bill.billDiscountPercent) / 100;
    } else if (bill.billDiscountAmount !== undefined && bill.billDiscountAmount > 0) {
      effectiveBillDiscountAmount = bill.billDiscountAmount;
    }
  }

  // Guard: Bill discount exceeds total net value
  if (effectiveBillDiscountAmount > totalNetAfterItemDiscounts && totalNetAfterItemDiscounts > 0) {
    warnings.push(
      `Bill discount (₹${effectiveBillDiscountAmount.toFixed(
        2
      )}) exceeded total net taxable value (₹${totalNetAfterItemDiscounts.toFixed(
        2
      )}). Capped at total net.`
    );
    effectiveBillDiscountAmount = totalNetAfterItemDiscounts;
  }

  // =========================================================================
  // STEP 4: Compute Final Line Taxable Values & Line GST
  // =========================================================================
  const calculatedLines: CalculatedLineItem[] = intermediateLines.map((line) => {
    let lineShare = 0;
    let lineBillDiscount = 0;

    if (totalNetAfterItemDiscounts > 0 && effectiveBillDiscountAmount > 0) {
      lineShare = line.lineNetAfterItemDiscount / totalNetAfterItemDiscounts;
      lineBillDiscount = effectiveBillDiscountAmount * lineShare;
    }

    let lineTaxableValue = line.lineNetAfterItemDiscount - lineBillDiscount;
    let isCapped = line.isCappedAtZero;

    if (lineTaxableValue < 0) {
      isCapped = true;
      lineTaxableValue = 0;
    }

    const gstRate = Math.max(0, Number(line.raw.gstRate) || 0);

    // GST Calculation per line on lineTaxableValue only
    let lineGstAmount = 0;
    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (!isCompositionScheme && gstRate > 0 && lineTaxableValue > 0) {
      lineGstAmount = lineTaxableValue * (gstRate / 100);

      if (isIntraState) {
        cgstRate = gstRate / 2;
        cgstAmount = lineGstAmount / 2;
        sgstRate = gstRate / 2;
        sgstAmount = lineGstAmount / 2;
        igstRate = 0;
        igstAmount = 0;
      } else {
        cgstRate = 0;
        cgstAmount = 0;
        sgstRate = 0;
        sgstAmount = 0;
        igstRate = gstRate;
        igstAmount = lineGstAmount;
      }
    }

    // Step 7: Line Final Display Amount
    const lineFinalAmount = lineTaxableValue + lineGstAmount;

    return {
      id: line.raw.id,
      name: line.raw.name,
      rawPrice: line.raw.price,
      qty: line.raw.qty,
      priceType: line.raw.priceType,
      gstRate,
      unitTaxableValue: line.unitTaxableValue,
      lineTaxableGross: line.lineTaxableGross,
      itemDiscountAmount: line.itemDiscountAmount,
      lineNetAfterItemDiscount: line.lineNetAfterItemDiscount,
      lineShareOfBill: lineShare,
      lineBillDiscount,
      lineTaxableValue,
      lineGstAmount,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      lineFinalAmount,
      isCappedAtZero: isCapped,
      warnings: line.lineWarnings.length > 0 ? line.lineWarnings : undefined,
    };
  });

  // Aggregate line-level warnings to bill warnings
  for (const line of calculatedLines) {
    if (line.warnings) {
      warnings.push(...line.warnings);
    }
  }

  // =========================================================================
  // STEP 5: Group by gstRate to produce Rate-Wise Summary Table (No HSN)
  // =========================================================================
  const rateBucketsMap = new Map<number, RateWiseSummaryBucket>();

  for (const line of calculatedLines) {
    const rate = line.gstRate;
    const existing = rateBucketsMap.get(rate) || {
      rate,
      totalTaxableValue: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalGst: 0,
      lineCount: 0,
    };

    existing.totalTaxableValue += line.lineTaxableValue;
    existing.totalCgst += line.cgstAmount;
    existing.totalSgst += line.sgstAmount;
    existing.totalIgst += line.igstAmount;
    existing.totalGst += line.lineGstAmount;
    existing.lineCount += 1;

    rateBucketsMap.set(rate, existing);
  }

  const rateWiseSummary: RateWiseSummaryBucket[] = Array.from(rateBucketsMap.values())
    .sort((a, b) => a.rate - b.rate)
    .map((bucket) => ({
      rate: bucket.rate,
      totalTaxableValue: round2(bucket.totalTaxableValue),
      totalCgst: round2(bucket.totalCgst),
      totalSgst: round2(bucket.totalSgst),
      totalIgst: round2(bucket.totalIgst),
      totalGst: round2(bucket.totalGst),
      lineCount: bucket.lineCount,
    }));

  // =========================================================================
  // STEP 6: Single-Pass Rounding & Round-Off Calculation
  // =========================================================================
  const totalGrossTaxable = calculatedLines.reduce((acc, l) => acc + l.lineTaxableGross, 0);
  const totalItemDiscounts = calculatedLines.reduce((acc, l) => acc + l.itemDiscountAmount, 0);
  const totalBillDiscount = calculatedLines.reduce((acc, l) => acc + l.lineBillDiscount, 0);
  const totalDiscounts = totalItemDiscounts + totalBillDiscount;
  const totalTaxableValue = calculatedLines.reduce((acc, l) => acc + l.lineTaxableValue, 0);

  const unroundedCgst = calculatedLines.reduce((acc, l) => acc + l.cgstAmount, 0);
  const unroundedSgst = calculatedLines.reduce((acc, l) => acc + l.sgstAmount, 0);
  const unroundedIgst = calculatedLines.reduce((acc, l) => acc + l.igstAmount, 0);
  const unroundedTotalTax = unroundedCgst + unroundedSgst + unroundedIgst;

  const totalCgst = round2(unroundedCgst);
  const totalSgst = round2(unroundedSgst);
  const totalIgst = round2(unroundedIgst);
  const totalTax = isCompositionScheme ? 0 : round2(totalCgst + totalSgst + totalIgst);

  const rawInvoiceTotal = totalTaxableValue + totalTax;

  let finalInvoiceTotal = rawInvoiceTotal;
  let roundOff = 0;

  if (roundingMode === 'nearest') {
    finalInvoiceTotal = Math.round(rawInvoiceTotal);
    roundOff = round2(finalInvoiceTotal - rawInvoiceTotal);
  } else {
    finalInvoiceTotal = round2(rawInvoiceTotal);
    roundOff = 0;
  }

  return {
    documentType: isCompositionScheme ? 'Bill of Supply' : 'Tax Invoice',
    isCompositionScheme,
    isIntraState,
    lines: calculatedLines,
    totalGrossTaxable: round2(totalGrossTaxable),
    totalItemDiscounts: round2(totalItemDiscounts),
    totalBillDiscount: round2(totalBillDiscount),
    totalDiscounts: round2(totalDiscounts),
    totalTaxableValue: round2(totalTaxableValue),
    unroundedCgst,
    unroundedSgst,
    unroundedIgst,
    unroundedTotalTax,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    rateWiseSummary,
    rawInvoiceTotal: round2(rawInvoiceTotal),
    roundOff,
    finalInvoiceTotal: round2(finalInvoiceTotal),
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
