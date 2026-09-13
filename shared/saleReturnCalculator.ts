import { round2 } from './gstTaxEngine';

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
  gstRate?: number;
  priceIncludesGst?: boolean;
  discount?: number;
  discountAmount?: number;
  taxAmount?: number;
  gstAmount?: number;
  total?: number;
  taxableAmount?: number;
  lineTaxableValue?: number;
  refundAmount?: number;
  lineFinalAmount?: number;
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

export interface OriginalSaleContext {
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  extraChargesTotal?: number;
  pastReturns?: Array<{
    items?: Array<{
      productId?: string;
      productName?: string;
      name?: string;
      quantity?: number;
      refundAmount?: number;
    }>;
    refundAmount?: number;
    subtotal?: number;
    totalTax?: number;
  }>;
}

export interface ComputedReturnSummary {
  items: ComputedReturnedLine[];
  subtotal: number; // returnsDeducted (taxable)
  totalTax: number; // returnsTaxDeducted (GST)
  extraChargesRefunded: number;
  refundAmount: number;
}

interface ResolvedOriginalLine {
  orig: OriginalSaleItem;
  origQty: number;
  unitPrice: number;
  taxRate: number;
  itemDiscount: number;
  priceIncludesGst: boolean;
  baselineTaxable: number;
  baselineGst: number;
  baselineTotal: number;
  finalTaxable: number;
  finalGst: number;
  finalTotal: number;
}

/**
 * Computes exact proportional values for returned items scaled strictly from original sale line items.
 *
 * CORE PRINCIPLE:
 * The return engine NEVER recomputes pricing, discounts, or GST from current product catalog or settings.
 * It reads actual stored values from the original Sale/SaleItem at sale time and derives refunds proportionally.
 *
 * Enforces reconciliation invariants:
 * 1. Full Return: refundAmount === Sale.grandTotal (plus any extraChargesRefunded).
 * 2. Partial Return: subtotal + totalTax === refundAmount (reconciliation on every line).
 * 3. Cumulative Partial Returns: sum of all returns equals Sale.grandTotal with zero rounding drift.
 */
export function calculateReturnSummary(
  originalItems: OriginalSaleItem[],
  returnRequests: ReturnItemRequest[],
  extraChargesRefunded = 0,
  saleContext?: OriginalSaleContext | null
): ComputedReturnSummary {
  const cleanExtraCharges = round2(Math.max(0, Number(extraChargesRefunded) || 0));

  if (!Array.isArray(originalItems) || originalItems.length === 0 || !Array.isArray(returnRequests) || returnRequests.length === 0) {
    return {
      items: [],
      subtotal: 0,
      totalTax: 0,
      extraChargesRefunded: cleanExtraCharges,
      refundAmount: cleanExtraCharges,
    };
  }

  // -------------------------------------------------------------------------
  // STEP 1: Resolve baseline stored post-item-discount values for all lines
  // -------------------------------------------------------------------------
  const resolvedLines: ResolvedOriginalLine[] = originalItems.map((orig) => {
    const origQty = Math.max(1, Number(orig.quantity) || 1);
    const unitPrice = Math.max(0, Number(orig.unitPrice ?? orig.sellingPrice ?? orig.price ?? 0));
    const taxRate = Math.max(0, Number(orig.taxRate ?? orig.gstRate ?? 0));
    const priceIncludesGst = Boolean(orig.priceIncludesGst);
    const itemDiscount = Math.max(0, Number(orig.discountAmount ?? orig.discount ?? 0));
    const storedTaxAmount = Number(orig.taxAmount ?? orig.gstAmount ?? 0);
    const storedTotal = Number(orig.total ?? orig.lineFinalAmount ?? 0);
    const storedTaxable = Number(orig.taxableAmount ?? orig.lineTaxableValue ?? 0);

    let baselineTaxable = 0;
    let baselineGst = 0;
    let baselineTotal = 0;

    if (storedTaxable > 0 && storedTaxAmount >= 0) {
      // Explicit stored post-discount taxable and tax
      baselineTaxable = storedTaxable;
      baselineGst = storedTaxAmount;
      baselineTotal = storedTotal > 0 ? storedTotal : round2(baselineTaxable + baselineGst);
    } else if (priceIncludesGst) {
      // Tax-inclusive pricing at sale time
      const grossAfterItemDisc = Math.max(0, unitPrice * origQty - itemDiscount);
      if (storedTaxAmount > 0) {
        baselineTaxable = round2(grossAfterItemDisc - storedTaxAmount);
        baselineGst = storedTaxAmount;
        baselineTotal = round2(grossAfterItemDisc);
      } else {
        baselineTaxable = taxRate > 0 ? round2(grossAfterItemDisc / (1 + taxRate / 100)) : round2(grossAfterItemDisc);
        baselineGst = round2(grossAfterItemDisc - baselineTaxable);
        baselineTotal = round2(grossAfterItemDisc);
      }
    } else {
      // Tax-exclusive pricing at sale time
      const netPreTax = Math.max(0, unitPrice * origQty - itemDiscount);
      baselineTaxable = round2(netPreTax);
      if (storedTaxAmount > 0) {
        baselineGst = storedTaxAmount;
      } else {
        baselineGst = taxRate > 0 ? round2(baselineTaxable * (taxRate / 100)) : 0;
      }
      baselineTotal = round2(baselineTaxable + baselineGst);
    }

    return {
      orig,
      origQty,
      unitPrice,
      taxRate,
      itemDiscount,
      priceIncludesGst,
      baselineTaxable,
      baselineGst,
      baselineTotal,
      finalTaxable: baselineTaxable,
      finalGst: baselineGst,
      finalTotal: baselineTotal,
    };
  });

  // -------------------------------------------------------------------------
  // STEP 2: Apportion bill-level discount across lines (if any was applied)
  // -------------------------------------------------------------------------
  const totalItemDiscounts = resolvedLines.reduce((sum, l) => sum + l.itemDiscount, 0);
  const totalSaleDiscount = Number(saleContext?.totalDiscount ?? totalItemDiscounts);
  const billDiscount = Math.max(0, round2(totalSaleDiscount - totalItemDiscounts));
  const totalBaselineTaxable = resolvedLines.reduce((sum, l) => sum + l.baselineTaxable, 0);

  if (billDiscount > 0 && totalBaselineTaxable > 0) {
    let allocatedBillDiscount = 0;
    resolvedLines.forEach((line, idx) => {
      const isLast = idx === resolvedLines.length - 1;
      const share = isLast
        ? Math.max(0, round2(billDiscount - allocatedBillDiscount))
        : round2(billDiscount * (line.baselineTaxable / totalBaselineTaxable));
      allocatedBillDiscount = round2(allocatedBillDiscount + share);

      const finalTaxable = Math.max(0, round2(line.baselineTaxable - share));
      const finalGst = line.taxRate > 0 ? round2(finalTaxable * (line.taxRate / 100)) : 0;
      const finalTotal = round2(finalTaxable + finalGst);

      line.finalTaxable = finalTaxable;
      line.finalGst = finalGst;
      line.finalTotal = finalTotal;
    });
  }

  // -------------------------------------------------------------------------
  // STEP 3: Tally past return quantities and detect full vs partial return
  // -------------------------------------------------------------------------
  const pastReturnedQtyMap = new Map<string, number>();
  let pastTotalRefunded = 0;

  if (saleContext?.pastReturns && Array.isArray(saleContext.pastReturns)) {
    for (const past of saleContext.pastReturns) {
      pastTotalRefunded = round2(pastTotalRefunded + (Number(past.refundAmount) || 0));
      const pastItems = Array.isArray(past.items) ? past.items : [];
      for (const p of pastItems) {
        const key = String(p.productId || p.productName || p.name || '');
        if (key) {
          pastReturnedQtyMap.set(key, (pastReturnedQtyMap.get(key) || 0) + (Number(p.quantity) || 0));
        }
      }
    }
  }

  const totalSaleQty = resolvedLines.reduce((sum, l) => sum + l.origQty, 0);
  const totalPastReturnedQty = Array.from(pastReturnedQtyMap.values()).reduce((sum, q) => sum + q, 0);
  const totalCurrentRequestedQty = returnRequests.reduce((sum, r) => sum + Math.max(0, Number(r.quantity) || 0), 0);

  const isFullInvoiceReturn =
    totalPastReturnedQty === 0 && totalCurrentRequestedQty === totalSaleQty && returnRequests.length === originalItems.length;

  const isFinalReturnCompletingInvoice =
    totalPastReturnedQty > 0 && totalPastReturnedQty + totalCurrentRequestedQty === totalSaleQty;

  // -------------------------------------------------------------------------
  // STEP 4: Compute proportional refund for each requested line
  // -------------------------------------------------------------------------
  const computedLines: ComputedReturnedLine[] = [];
  let subtotal = 0;
  let totalTax = 0;
  let totalRefund = 0;

  for (const req of returnRequests) {
    if (!req.quantity || req.quantity <= 0) continue;

    const matched = resolvedLines.find(
      (line) =>
        (line.orig.productId && req.productId && line.orig.productId === req.productId) ||
        (line.orig.id && req.id && line.orig.id === req.id) ||
        (line.orig.productName && req.productName && line.orig.productName === req.productName) ||
        (line.orig.name && req.name && line.orig.name === req.name)
    );

    if (!matched) {
      throw new Error(`Item ${req.productName || req.productId || 'unknown'} not found in original sale`);
    }

    const returnQty = Math.min(Number(req.quantity), matched.origQty);
    const ratio = returnQty / matched.origQty;

    let lineRefund = round2(matched.finalTotal * ratio);
    let lineGst = round2(matched.finalGst * ratio);
    let lineTaxable = round2(lineRefund - lineGst); // Exact invariant: lineTaxable + lineGst === lineRefund

    computedLines.push({
      productId: matched.orig.productId || matched.orig.id,
      productName: matched.orig.productName || matched.orig.name || 'Product',
      quantity: returnQty,
      unitPrice: matched.unitPrice,
      taxRate: matched.taxRate,
      taxableAmount: lineTaxable,
      gstAmount: lineGst,
      refundAmount: lineRefund,
      restock: req.restock ?? true,
    });

    subtotal = round2(subtotal + lineTaxable);
    totalTax = round2(totalTax + lineGst);
    totalRefund = round2(totalRefund + lineRefund);
  }

  // -------------------------------------------------------------------------
  // STEP 5: Reconciliation against stored sale figures (Invariants 1 & 4)
  // -------------------------------------------------------------------------
  let finalRefundAmount = totalRefund;

  if (isFullInvoiceReturn && saleContext?.grandTotal !== undefined && saleContext.grandTotal > 0) {
    // Invariant 1: Full invoice return must refund EXACTLY Sale.grandTotal
    finalRefundAmount = saleContext.grandTotal;
    subtotal = Number(saleContext.subtotal ?? subtotal);
    totalTax = Number(saleContext.totalTax ?? totalTax);

    // Reconcile line items so their sum matches exact stored figures
    const refundDiff = round2(finalRefundAmount - totalRefund);
    const taxableDiff = round2(subtotal - computedLines.reduce((s, l) => s + l.taxableAmount, 0));
    const taxDiff = round2(totalTax - computedLines.reduce((s, l) => s + l.gstAmount, 0));

    if (computedLines.length > 0) {
      const primaryLine = computedLines.reduce((prev, curr) => (curr.refundAmount > prev.refundAmount ? curr : prev), computedLines[0]);
      primaryLine.refundAmount = round2(primaryLine.refundAmount + refundDiff);
      primaryLine.taxableAmount = round2(primaryLine.taxableAmount + taxableDiff);
      primaryLine.gstAmount = round2(primaryLine.gstAmount + taxDiff);
    }
  } else if (isFinalReturnCompletingInvoice && saleContext?.grandTotal !== undefined && saleContext.grandTotal > 0) {
    // Invariant 4: Absorbs any cumulative fractional paise drift on the last partial return
    const remainingInvoiceBalance = Math.max(0, round2(saleContext.grandTotal - pastTotalRefunded));
    const drift = round2(remainingInvoiceBalance - totalRefund);
    if (Math.abs(drift) > 0 && Math.abs(drift) <= 1.0 && computedLines.length > 0) {
      finalRefundAmount = remainingInvoiceBalance;
      const primaryLine = computedLines.reduce((prev, curr) => (curr.refundAmount > prev.refundAmount ? curr : prev), computedLines[0]);
      primaryLine.refundAmount = round2(primaryLine.refundAmount + drift);
      primaryLine.taxableAmount = round2(primaryLine.taxableAmount + drift);
      subtotal = round2(subtotal + drift);
    }
  }

  const grandRefundTotal = round2(finalRefundAmount + cleanExtraCharges);

  return {
    items: computedLines,
    subtotal: round2(subtotal),
    totalTax: round2(totalTax),
    extraChargesRefunded: cleanExtraCharges,
    refundAmount: grandRefundTotal,
  };
}
