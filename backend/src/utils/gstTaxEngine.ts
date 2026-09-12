/**
 * GST-Compliant Tax & Discount Calculation Engine
 * Legally compliant with Section 15 of the Central Goods and Services Tax (CGST) Act, 2017.
 */

export type PriceType = 'inclusive' | 'exclusive';

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
    effectiveBillDiscountAmount = totalNetAfterItemDiscounts;
  }

  const calculatedLines: CalculatedLineItem[] = intermediateLines.map((line) => {
    let lineShare = 0;
    let lineBillDiscount = 0;

    if (totalNetAfterItemDiscounts > 0 && effectiveBillDiscountAmount > 0) {
      lineShare = line.lineNetAfterItemDiscount / totalNetAfterItemDiscounts;
      lineBillDiscount = effectiveBillDiscountAmount * lineShare;
    }

    let lineTaxableValue = round2(Math.max(0, line.lineNetAfterItemDiscount - lineBillDiscount));
    let isCapped = line.isCappedAtZero;

    const gstRate = Math.max(0, Number(line.raw.gstRate) || 0);

    let lineGstAmount = 0;
    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (!isCompositionScheme && gstRate > 0 && lineTaxableValue > 0) {
      lineGstAmount = round2(lineTaxableValue * (gstRate / 100));

      if (isIntraState) {
        cgstRate = gstRate / 2;
        cgstAmount = round2(lineGstAmount / 2);
        sgstRate = gstRate / 2;
        sgstAmount = round2(lineGstAmount - cgstAmount);
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

    const lineFinalAmount = round2(lineTaxableValue + lineGstAmount);

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

  for (const line of calculatedLines) {
    if (line.warnings) {
      warnings.push(...line.warnings);
    }
  }

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

  const totalGrossTaxable = calculatedLines.reduce((acc, l) => acc + l.lineTaxableGross, 0);
  const totalItemDiscounts = calculatedLines.reduce((acc, l) => acc + l.itemDiscountAmount, 0);
  const totalBillDiscount = calculatedLines.reduce((acc, l) => acc + l.lineBillDiscount, 0);
  const totalDiscounts = totalItemDiscounts + totalBillDiscount;
  const totalTaxableValue = round2(calculatedLines.reduce((acc, l) => acc + l.lineTaxableValue, 0));

  const totalCgst = round2(calculatedLines.reduce((acc, l) => acc + l.cgstAmount, 0));
  const totalSgst = round2(calculatedLines.reduce((acc, l) => acc + l.sgstAmount, 0));
  const totalIgst = round2(calculatedLines.reduce((acc, l) => acc + l.igstAmount, 0));
  const totalTax = isCompositionScheme ? 0 : round2(calculatedLines.reduce((acc, l) => acc + l.lineGstAmount, 0));

  const unroundedCgst = totalCgst;
  const unroundedSgst = totalSgst;
  const unroundedIgst = totalIgst;
  const unroundedTotalTax = totalTax;

  const rawInvoiceTotal = round2(calculatedLines.reduce((acc, l) => acc + l.lineFinalAmount, 0));

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
