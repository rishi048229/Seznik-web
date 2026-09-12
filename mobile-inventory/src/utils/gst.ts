import { calculateGstBill, round2, type BillInput, type LineItemInput } from '@shared/gstTaxEngine';

/** Round to 2 decimal places (paise) as per GST invoicing practice. */
export function roundGstAmount(value: number): number {
  return round2(value);
}

export interface ProductGstBreakdown {
  /** Assessable / taxable value before GST */
  taxableValue: number;
  /** Central GST rate (half of total GST rate for intra-state supply) */
  cgstRate: number;
  /** State GST rate (half of total GST rate for intra-state supply) */
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  /** Combined CGST + SGST */
  totalGst: number;
  /** Price payable by customer (MRP) */
  finalPrice: number;
  enteredPrice: number;
  gstRate: number;
  priceIncludesGst: boolean;
}

/**
  * Calculate GST breakdown for a product price under Section 15 of CGST Act.
  */
export function calculateProductGstBreakdown(
  enteredPrice: number,
  gstRate: number,
  priceIncludesGst: boolean,
): ProductGstBreakdown {
  const bill: BillInput = {
    lineItems: [
      {
        price: enteredPrice,
        qty: 1,
        gstRate,
        priceType: priceIncludesGst ? 'inclusive' : 'exclusive',
      },
    ],
    isIntraState: true,
  };

  const result = calculateGstBill(bill);
  const line = result.lines[0];

  if (!line) {
    return {
      taxableValue: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGst: 0,
      finalPrice: 0,
      enteredPrice,
      gstRate,
      priceIncludesGst,
    };
  }

  return {
    taxableValue: round2(line.lineTaxableValue),
    cgstRate: line.cgstRate,
    sgstRate: line.sgstRate,
    cgstAmount: round2(line.cgstAmount),
    sgstAmount: round2(line.sgstAmount),
    totalGst: round2(line.lineGstAmount),
    finalPrice: round2(line.lineFinalAmount),
    enteredPrice,
    gstRate,
    priceIncludesGst,
  };
}

export function formatInr(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export interface GstLineInput {
  sellingPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  priceIncludesGst: boolean;
}

export interface GstSlabRow {
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGst: number;
}

export interface GstBillSummary {
  taxableValue: number;
  totalGst: number;
  cgstAmount: number;
  sgstAmount: number;
  slabs: GstSlabRow[];
}

/** GST on a billed line (qty × price − discount), Section 15 compliant. */
export function calculateLineGstBreakdown(
  sellingPrice: number,
  quantity: number,
  discount: number,
  gstRate: number,
  priceIncludesGst: boolean,
): ProductGstBreakdown {
  const bill: BillInput = {
    lineItems: [
      {
        price: sellingPrice,
        qty: quantity,
        gstRate,
        priceType: priceIncludesGst ? 'inclusive' : 'exclusive',
        itemDiscountAmount: discount,
      },
    ],
    isIntraState: true,
  };

  const result = calculateGstBill(bill);
  const line = result.lines[0];

  if (!line) {
    return {
      taxableValue: 0,
      cgstRate: 0,
      sgstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGst: 0,
      finalPrice: 0,
      enteredPrice: sellingPrice,
      gstRate,
      priceIncludesGst,
    };
  }

  return {
    taxableValue: round2(line.lineTaxableValue),
    cgstRate: line.cgstRate,
    sgstRate: line.sgstRate,
    cgstAmount: round2(line.cgstAmount),
    sgstAmount: round2(line.sgstAmount),
    totalGst: round2(line.lineGstAmount),
    finalPrice: round2(line.lineFinalAmount),
    enteredPrice: sellingPrice,
    gstRate,
    priceIncludesGst,
  };
}

export function splitCgstSgst(totalGst: number): { cgst: number; sgst: number } {
  const cgst = roundGstAmount(totalGst / 2);
  const sgst = roundGstAmount(totalGst - cgst);
  return { cgst, sgst };
}

/** Group a bill's lines by GST slab for restaurant / mixed-rate invoices. */
export function computeGstBillSummary(lines: GstLineInput[], extraBillDiscount = 0): GstBillSummary {
  const lineItems: LineItemInput[] = lines.map((l) => ({
    price: l.sellingPrice,
    qty: l.quantity,
    gstRate: l.taxRate,
    priceType: l.priceIncludesGst ? 'inclusive' : 'exclusive',
    itemDiscountAmount: l.discount,
  }));

  const result = calculateGstBill({
    lineItems,
    billDiscountAmount: extraBillDiscount,
    isIntraState: true,
  });

  const slabs: GstSlabRow[] = result.rateWiseSummary.map((bucket) => ({
    gstRate: bucket.rate,
    cgstRate: bucket.rate / 2,
    sgstRate: bucket.rate / 2,
    taxableValue: bucket.totalTaxableValue,
    cgstAmount: bucket.totalCgst,
    sgstAmount: bucket.totalSgst,
    totalGst: bucket.totalGst,
  }));

  return {
    taxableValue: result.totalTaxableValue,
    totalGst: result.totalTax,
    cgstAmount: result.totalCgst,
    sgstAmount: result.totalSgst,
    slabs,
  };
}

export function gstLinesFromSaleItems(
  items: {
    unitPrice?: number;
    sellingPrice?: number;
    quantity?: number;
    discount?: number;
    discountAmount?: number;
    taxRate?: number;
    priceIncludesGst?: boolean;
  }[],
): GstLineInput[] {
  return items.map((item) => ({
    sellingPrice: item.unitPrice ?? item.sellingPrice ?? 0,
    quantity: item.quantity ?? 1,
    discount: item.discountAmount ?? item.discount ?? 0,
    taxRate: item.taxRate ?? 0,
    priceIncludesGst: Boolean(item.priceIncludesGst),
  }));
}

