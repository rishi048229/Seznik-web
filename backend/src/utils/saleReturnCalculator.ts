export interface OriginalSaleItem {
  productId?: string;
  id?: string;
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  sellingPrice?: number;
  price?: number;
  taxRate?: number;
  priceIncludesGst?: boolean;
  discount?: number;
  discountAmount?: number;
  taxAmount?: number;
  total?: number;
}

export interface ReturnItemRequest {
  productId?: string;
  id?: string;
  productName?: string;
  name?: string;
  quantity: number; // Returned qty
  restock?: boolean; // Default true
}

export interface ComputedReturnedLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxableAmount: number;
  gstAmount: number;
  refundAmount: number;
  restock: boolean;
}

export interface ComputedReturnSummary {
  items: ComputedReturnedLine[];
  subtotal: number; // returnsDeducted (taxable)
  totalTax: number; // returnsTaxDeducted (GST)
  extraChargesRefunded: number;
  refundAmount: number;
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Computes exact proportional values for returned items scaled from original sale line items.
 * Enforces reconciliation invariant: round2(subtotal + totalTax + extraChargesRefunded) === round2(refundAmount).
 */
export function calculateReturnSummary(
  originalItems: OriginalSaleItem[],
  returnRequests: ReturnItemRequest[],
  extraChargesRefunded = 0
): ComputedReturnSummary {
  const computedLines: ComputedReturnedLine[] = [];
  let subtotal = 0;
  let totalTax = 0;
  let totalRefund = 0;

  for (const req of returnRequests) {
    if (!req.quantity || req.quantity <= 0) continue;

    const orig = originalItems.find(
      (item) =>
        (item.productId && req.productId && item.productId === req.productId) ||
        (item.id && req.id && item.id === req.id) ||
        (item.productName && req.productName && item.productName === req.productName) ||
        (item.name && req.name && item.name === req.name)
    );

    if (!orig) {
      throw new Error(`Item ${req.productName || req.productId || 'unknown'} not found in original sale`);
    }

    const origQty = Number(orig.quantity) || 1;
    const returnQty = Math.min(Number(req.quantity), origQty);
    const ratio = returnQty / origQty;

    const unitPrice = Number(orig.unitPrice ?? orig.sellingPrice ?? orig.price ?? 0);
    const taxRate = Number(orig.taxRate ?? 0);
    const priceIncludesGst = Boolean(orig.priceIncludesGst);
    const discount = Number(orig.discountAmount ?? orig.discount ?? 0);
    const taxAmount = Number(orig.taxAmount ?? 0);

    let originalLineTotal = Number(orig.total);
    if (!Number.isFinite(originalLineTotal) || originalLineTotal <= 0) {
      const gross = unitPrice * origQty - discount;
      originalLineTotal = priceIncludesGst || taxRate === 0 ? gross : gross * (1 + taxRate / 100);
    } else if (!priceIncludesGst && taxRate > 0) {
      // If line item total was saved as pre-tax subtotal (unitPrice * origQty - discount), include the GST customer paid
      if (taxAmount > 0 && Math.abs(originalLineTotal - (unitPrice * origQty - discount)) < 0.01) {
        originalLineTotal = round2(originalLineTotal + taxAmount);
      } else if (Math.abs(originalLineTotal - (unitPrice * origQty - discount)) < 0.01) {
        originalLineTotal = round2(originalLineTotal * (1 + taxRate / 100));
      }
    }

    // Proportional refund for this line
    const lineRefund = round2(originalLineTotal * ratio);

    let lineTaxable = lineRefund;
    let lineGst = 0;

    if (taxRate > 0) {
      if (priceIncludesGst) {
        lineTaxable = round2(lineRefund / (1 + taxRate / 100));
        lineGst = round2(lineRefund - lineTaxable);
      } else {
        lineTaxable = round2((unitPrice * origQty - discount) * ratio);
        lineGst = round2(lineRefund - lineTaxable);
      }
    }

    computedLines.push({
      productId: orig.productId || orig.id,
      productName: orig.productName || orig.name || 'Product',
      quantity: returnQty,
      unitPrice,
      taxRate,
      taxableAmount: lineTaxable,
      gstAmount: lineGst,
      refundAmount: lineRefund,
      restock: req.restock ?? true,
    });

    subtotal = round2(subtotal + lineTaxable);
    totalTax = round2(totalTax + lineGst);
    totalRefund = round2(totalRefund + lineRefund);
  }

  const cleanExtraCharges = round2(Math.max(0, Number(extraChargesRefunded) || 0));
  const finalRefundAmount = round2(totalRefund + cleanExtraCharges);

  return {
    items: computedLines,
    subtotal,
    totalTax,
    extraChargesRefunded: cleanExtraCharges,
    refundAmount: finalRefundAmount,
  };
}
