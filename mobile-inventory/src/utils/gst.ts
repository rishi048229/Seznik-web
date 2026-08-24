/** Round to 2 decimal places (paise) as per GST invoicing practice. */
export function roundGstAmount(value: number): number {
  return Math.round(value * 100) / 100;
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
 * Calculate GST breakdown for a product price under Indian GST law.
 *
 * - GST Inclusive: entered price is the final MRP; GST is extracted from it.
 *   Taxable Value = Price ÷ (1 + GST%/100)
 *   Total GST = Price − Taxable Value
 *
 * - GST Exclusive: entered price is the taxable value; GST is added on top.
 *   Total GST = Taxable Value × GST%/100
 *   Final Price = Taxable Value + Total GST
 *
 * CGST and SGST each equal half of Total GST (intra-state supply).
 */
export function calculateProductGstBreakdown(
  enteredPrice: number,
  gstRate: number,
  priceIncludesGst: boolean,
): ProductGstBreakdown {
  const rate = Math.max(0, gstRate);
  const price = Math.max(0, enteredPrice);

  let taxableValue: number;
  let totalGst: number;
  let finalPrice: number;

  if (rate === 0 || price === 0) {
    taxableValue = price;
    totalGst = 0;
    finalPrice = price;
  } else if (priceIncludesGst) {
    taxableValue = roundGstAmount(price / (1 + rate / 100));
    totalGst = roundGstAmount(price - taxableValue);
    finalPrice = price;
  } else {
    taxableValue = price;
    totalGst = roundGstAmount(price * (rate / 100));
    finalPrice = roundGstAmount(price + totalGst);
  }

  const halfRate = rate / 2;
  const cgstAmount = roundGstAmount(totalGst / 2);
  const sgstAmount = roundGstAmount(totalGst - cgstAmount);

  return {
    taxableValue,
    cgstRate: halfRate,
    sgstRate: halfRate,
    cgstAmount,
    sgstAmount,
    totalGst,
    finalPrice,
    enteredPrice: price,
    gstRate: rate,
    priceIncludesGst,
  };
}

export function formatInr(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}
