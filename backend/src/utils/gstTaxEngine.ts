/**
 * GST-Compliant Tax & Discount Calculation Engine
 * Legally compliant with Section 15 of the Central Goods and Services Tax (CGST) Act, 2017.
 *
 * CORE PRINCIPLES:
 * 1. GST is always calculated on (Taxable Value − Discount), never on the original inclusive price.
 * 2. Discounts applied at or before invoicing directly reduce the taxable value when appearing on the invoice.
 * 3. Apportionment of bill-level discounts is value-weighted across normalized taxable values of all lines.
 * 4. Carries full (unrounded) precision through discount apportionment and GST calculation.
 * 5. Single-pass rounding per tax component and final invoice total, avoiding intermediate rounding drift.
 * 6. Supports Composition Scheme ("Bill of Supply") and BOGO models.
 */

export type PriceType = 'inclusive' | 'exclusive';

/** Standard Indian GST rate slabs (0%, 5%, 12%, 18%, 28%, 40%) */
export const VALID_GST_SLABS = [0, 5, 12, 18, 28, 40] as const;
export type ValidGstSlab = typeof VALID_GST_SLABS[number];

export interface DiscountMetadata {
  type?: 'item_discount' | 'bill_discount' | 'coupon' | 'bogo' | 'custom';
  hasReciprocalObligation?: boolean;
  isPostSaleRebate?: boolean;
  codeOrDescription?: string;
}

export interface LineItemInput {
  id?: string;
  name?: string;
  price: number;
  qty: number;
  gstRate: number;
  priceType: PriceType;
  itemDiscountAmount?: number;
  itemDiscountPercent?: number;
  isBogo?: boolean;
  bogoDiscountPercent?: number;
  discountMetadata?: DiscountMetadata;
}

export interface BillInput {
  lineItems: LineItemInput[];
  billDiscountAmount?: number;
  billDiscountPercent?: number;
  isIntraState?: boolean;
  isCompositionScheme?: boolean;
  billDiscountMetadata?: DiscountMetadata;
  roundingMode?: 'nearest' | 'none';
}

export interface CalculatedLineItem {
  id?: string;
  name?: string;
  rawPrice: number;
  qty: number;
  priceType: PriceType;
  gstRate: number;

  unitTaxableValue: number;
  lineTaxableGross: number;

  itemDiscountAmount: number;
  lineNetAfterItemDiscount: number;

  lineShareOfBill: number;
  lineBillDiscount: number;
  lineTaxableValue: number;

  lineGstAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;

  lineFinalAmount: number;

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

  lines: CalculatedLineItem[];

  totalGrossTaxable: number;
  totalItemDiscounts: number;
  totalBillDiscount: number;
  totalDiscounts: number;
  totalTaxableValue: number;

  unroundedCgst: number;
  unroundedSgst: number;
  unroundedIgst: number;
  unroundedTotalTax: number;

  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;

  rateWiseSummary: RateWiseSummaryBucket[];

  rawInvoiceTotal: number;
  roundOff: number;
  finalInvoiceTotal: number;

  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function round4(num: number): number {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

export function isValidGstSlab(rate: number): boolean {
  return VALID_GST_SLABS.includes(rate as ValidGstSlab);
}

export function calculateGstBill(bill: BillInput): GstBillCalculationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isCompositionScheme = Boolean(bill.isCompositionScheme);
  const isIntraState = bill.isIntraState !== false;
  const roundingMode = bill.roundingMode ?? 'nearest';

  const rawLines = bill.lineItems || [];

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

  if (bill.billDiscountMetadata?.hasReciprocalObligation) {
    warnings.push(
      'Bill discount has reciprocal promotional/service obligation: Excluded from Section 15 pre-supply discount.'
    );
  }
  if (bill.billDiscountMetadata?.isPostSaleRebate) {
    warnings.push(
      'Bill discount flagged as post-sale rebate: Excluded from real-time invoice GST deduction.'
    );
  }

  const allowBillDiscount =
    !bill.billDiscountMetadata?.hasReciprocalObligation &&
    !bill.billDiscountMetadata?.isPostSaleRebate;

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
        `Item "${item.name || idx + 1}" uses non-standard GST rate ${gstRate}%.`
      );
    }

    let unitTaxableValue = 0;
    let lineTaxableGross = 0;

    if (item.priceType === 'inclusive') {
      unitTaxableValue = gstRate > 0 ? price / (1 + gstRate / 100) : price;
      lineTaxableGross = unitTaxableValue * qty;
    } else {
      unitTaxableValue = price;
      lineTaxableGross = price * qty;
    }

    let calculatedItemDiscount = 0;
    const hasReciprocal = Boolean(item.discountMetadata?.hasReciprocalObligation);
    const isPostRebate = Boolean(item.discountMetadata?.isPostSaleRebate);

    if (hasReciprocal) {
      lineWarnings.push(
        `Item "${item.name || idx + 1}" discount has reciprocal obligation.`
      );
    }
    if (isPostRebate) {
      lineWarnings.push(
        `Item "${item.name || idx + 1}" discount is a post-sale rebate.`
      );
    }

    const allowItemDiscount = !hasReciprocal && !isPostRebate;

    if (allowItemDiscount) {
      if (item.isBogo) {
        const bogoPercent = item.bogoDiscountPercent ?? 50;
        calculatedItemDiscount = (lineTaxableGross * bogoPercent) / 100;
      } else if (item.itemDiscountPercent !== undefined && item.itemDiscountPercent > 0) {
        calculatedItemDiscount = (lineTaxableGross * item.itemDiscountPercent) / 100;
      } else if (item.itemDiscountAmount !== undefined && item.itemDiscountAmount > 0) {
        if (item.priceType === 'inclusive' && gstRate > 0) {
          calculatedItemDiscount = item.itemDiscountAmount / (1 + gstRate / 100);
        } else {
          calculatedItemDiscount = item.itemDiscountAmount;
        }
      }
    }

    let lineNetAfterItemDiscount = lineTaxableGross - calculatedItemDiscount;
    let isCappedAtZero = false;

    if (lineNetAfterItemDiscount < 0) {
      isCappedAtZero = true;
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

  if (effectiveBillDiscountAmount > totalNetAfterItemDiscounts && totalNetAfterItemDiscounts > 0) {
    warnings.push('Bill discount exceeded total net taxable value. Capped at total net.');
    effectiveBillDiscountAmount = totalNetAfterItemDiscounts;
  }

  interface ProcessedLine {
    raw: LineItemInput;
    unitTaxableValue: number;
    lineTaxableGross: number;
    itemDiscountAmount: number;
    lineNetAfterItemDiscount: number;
    lineShareOfBill: number;
    lineBillDiscount: number;
    unroundedTaxable: number;
    unroundedGst: number;
    unroundedCgst: number;
    unroundedSgst: number;
    unroundedIgst: number;
    unroundedFinalAmount: number;
    isCappedAtZero: boolean;
    lineWarnings?: string[];
  }

  const processedLines: ProcessedLine[] = intermediateLines.map((line) => {
    let lineShare = 0;
    let lineBillDiscount = 0;

    if (totalNetAfterItemDiscounts > 0 && effectiveBillDiscountAmount > 0) {
      lineShare = line.lineNetAfterItemDiscount / totalNetAfterItemDiscounts;
      lineBillDiscount = effectiveBillDiscountAmount * lineShare;
    }

    const unroundedTaxable = Math.max(0, line.lineNetAfterItemDiscount - lineBillDiscount);
    const gstRate = Math.max(0, Number(line.raw.gstRate) || 0);

    let unroundedGst = 0;
    let unroundedCgst = 0;
    let unroundedSgst = 0;
    let unroundedIgst = 0;

    if (!isCompositionScheme && gstRate > 0 && unroundedTaxable > 0) {
      unroundedGst = unroundedTaxable * (gstRate / 100);

      if (isIntraState) {
        unroundedCgst = unroundedGst / 2;
        unroundedSgst = unroundedGst / 2;
        unroundedIgst = 0;
      } else {
        unroundedCgst = 0;
        unroundedSgst = 0;
        unroundedIgst = unroundedGst;
      }
    }

    const unroundedFinalAmount = unroundedTaxable + unroundedGst;

    return {
      raw: line.raw,
      unitTaxableValue: line.unitTaxableValue,
      lineTaxableGross: line.lineTaxableGross,
      itemDiscountAmount: line.itemDiscountAmount,
      lineNetAfterItemDiscount: line.lineNetAfterItemDiscount,
      lineShareOfBill: lineShare,
      lineBillDiscount,
      unroundedTaxable,
      unroundedGst,
      unroundedCgst,
      unroundedSgst,
      unroundedIgst,
      unroundedFinalAmount,
      isCappedAtZero: line.isCappedAtZero,
      lineWarnings: line.lineWarnings.length > 0 ? line.lineWarnings : undefined,
    };
  });

  const calculatedLines: CalculatedLineItem[] = processedLines.map((line) => {
    const gstRate = Math.max(0, Number(line.raw.gstRate) || 0);
    const lineTaxableValue = round2(line.unroundedTaxable);
    const lineGstAmount = round2(line.unroundedGst);
    const cgstAmount = isIntraState ? round2(line.unroundedCgst) : 0;
    const sgstAmount = isIntraState ? round2(line.unroundedGst - round2(line.unroundedCgst)) : 0;
    const igstAmount = !isIntraState ? round2(line.unroundedIgst) : 0;
    const lineFinalAmount = round2(line.unroundedFinalAmount);

    return {
      id: line.raw.id,
      name: line.raw.name,
      rawPrice: line.raw.price,
      qty: line.raw.qty,
      priceType: line.raw.priceType,
      gstRate,
      unitTaxableValue: round2(line.unitTaxableValue),
      lineTaxableGross: round2(line.lineTaxableGross),
      itemDiscountAmount: round2(line.itemDiscountAmount),
      lineNetAfterItemDiscount: round2(line.lineNetAfterItemDiscount),
      lineShareOfBill: round4(line.lineShareOfBill),
      lineBillDiscount: round2(line.lineBillDiscount),
      lineTaxableValue,
      lineGstAmount,
      cgstRate: isIntraState ? gstRate / 2 : 0,
      cgstAmount,
      sgstRate: isIntraState ? gstRate / 2 : 0,
      sgstAmount,
      igstRate: !isIntraState ? gstRate : 0,
      igstAmount,
      lineFinalAmount,
      isCappedAtZero: line.isCappedAtZero,
      warnings: line.lineWarnings,
    };
  });

  for (const line of calculatedLines) {
    if (line.warnings) {
      warnings.push(...line.warnings);
    }
  }

  const rateBucketsMap = new Map<number, { rate: number; unroundedTaxable: number; unroundedCgst: number; unroundedSgst: number; unroundedIgst: number; unroundedGst: number; lineCount: number }>();

  for (const line of processedLines) {
    const rate = Math.max(0, Number(line.raw.gstRate) || 0);
    const existing = rateBucketsMap.get(rate) || {
      rate,
      unroundedTaxable: 0,
      unroundedCgst: 0,
      unroundedSgst: 0,
      unroundedIgst: 0,
      unroundedGst: 0,
      lineCount: 0,
    };

    existing.unroundedTaxable += line.unroundedTaxable;
    existing.unroundedCgst += line.unroundedCgst;
    existing.unroundedSgst += line.unroundedSgst;
    existing.unroundedIgst += line.unroundedIgst;
    existing.unroundedGst += line.unroundedGst;
    existing.lineCount += 1;

    rateBucketsMap.set(rate, existing);
  }

  const rateWiseSummary: RateWiseSummaryBucket[] = Array.from(rateBucketsMap.values())
    .sort((a, b) => a.rate - b.rate)
    .map((bucket) => {
      const totalTaxableValue = round2(bucket.unroundedTaxable);
      const totalGst = round2(bucket.unroundedGst);
      const totalCgst = isIntraState ? round2(bucket.unroundedCgst) : 0;
      const totalSgst = isIntraState ? round2(totalGst - totalCgst) : 0;
      const totalIgst = !isIntraState ? round2(bucket.unroundedIgst) : 0;

      return {
        rate: bucket.rate,
        totalTaxableValue,
        totalCgst,
        totalSgst,
        totalIgst,
        totalGst,
        lineCount: bucket.lineCount,
      };
    });

  const unroundedTotalGrossTaxable = processedLines.reduce((acc, l) => acc + l.lineTaxableGross, 0);
  const unroundedTotalItemDiscounts = processedLines.reduce((acc, l) => acc + l.itemDiscountAmount, 0);
  const unroundedTotalBillDiscount = processedLines.reduce((acc, l) => acc + l.lineBillDiscount, 0);
  const unroundedTotalTaxableValue = processedLines.reduce((acc, l) => acc + l.unroundedTaxable, 0);
  const unroundedTotalCgst = processedLines.reduce((acc, l) => acc + l.unroundedCgst, 0);
  const unroundedTotalSgst = processedLines.reduce((acc, l) => acc + l.unroundedSgst, 0);
  const unroundedTotalIgst = processedLines.reduce((acc, l) => acc + l.unroundedIgst, 0);
  const unroundedTotalTax = isCompositionScheme ? 0 : processedLines.reduce((acc, l) => acc + l.unroundedGst, 0);
  const unroundedRawInvoiceTotal = processedLines.reduce((acc, l) => acc + l.unroundedFinalAmount, 0);

  const totalGrossTaxable = round2(unroundedTotalGrossTaxable);
  const totalItemDiscounts = round2(unroundedTotalItemDiscounts);
  const totalBillDiscount = round2(unroundedTotalBillDiscount);
  const totalDiscounts = round2(totalItemDiscounts + totalBillDiscount);
  const totalTaxableValue = round2(unroundedTotalTaxableValue);

  const totalCgst = round2(unroundedTotalCgst);
  const totalSgst = round2(unroundedTotalSgst);
  const totalIgst = round2(unroundedTotalIgst);
  const totalTax = round2(unroundedTotalTax);

  const rawInvoiceTotal = round2(unroundedRawInvoiceTotal);

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
    totalGrossTaxable,
    totalItemDiscounts,
    totalBillDiscount,
    totalDiscounts,
    totalTaxableValue,
    unroundedCgst: unroundedTotalCgst,
    unroundedSgst: unroundedTotalSgst,
    unroundedIgst: unroundedTotalIgst,
    unroundedTotalTax,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    rateWiseSummary,
    rawInvoiceTotal,
    roundOff,
    finalInvoiceTotal,
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
