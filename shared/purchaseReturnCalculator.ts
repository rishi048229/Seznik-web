import { round2 } from './gstTaxEngine';

export interface OriginalPurchaseItem {
  productId?: string;
  id?: string;
  productName?: string;
  name?: string;
  quantity: number;
  costPrice?: number;
  unitPrice?: number;
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

export interface PurchaseReturnItemRequest {
  productId?: string;
  id?: string;
  productName?: string;
  name?: string;
  quantity: number; // Returned qty
  unitCost?: number;
}

export interface ComputedReturnedPurchaseLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxableAmount: number;
  gstAmount: number;
  refundAmount: number;
}

export interface OriginalPurchaseContext {
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
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

export interface ComputedPurchaseReturnSummary {
  items: ComputedReturnedPurchaseLine[];
  subtotal: number; // Taxable value reversed
  totalTax: number; // ITC amount reversed
  refundAmount: number; // Total debit amount / refund from supplier
}

interface ResolvedOriginalPurchaseLine {
  orig: OriginalPurchaseItem;
  origQty: number;
  unitCost: number;
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
 * Computes exact proportional values for returned purchase items scaled strictly from original purchase records.
 *
 * CORE PRINCIPLE:
 * The return engine NEVER recomputes pricing, tax, or discounts from the product's CURRENT purchase price
 * or the supplier's CURRENT terms. It ALWAYS reads exact stored values from the original Purchase/PurchaseItem record.
 *
 * Enforces reconciliation invariants:
 * 1. Full Return: refundAmount === Purchase.grandTotal
 * 2. Partial Return: round2(subtotal + totalTax) === round2(refundAmount)
 * 3. Multi-rate GST: Carry full precision through component scaling, round once at the end per component.
 */
export function calculatePurchaseReturnSummary(
  originalItems: OriginalPurchaseItem[],
  returnRequests: PurchaseReturnItemRequest[],
  purchaseContext?: OriginalPurchaseContext | null
): ComputedPurchaseReturnSummary {
  if (!Array.isArray(originalItems) || originalItems.length === 0 || !Array.isArray(returnRequests) || returnRequests.length === 0) {
    return {
      items: [],
      subtotal: 0,
      totalTax: 0,
      refundAmount: 0,
    };
  }

  // -------------------------------------------------------------------------
  // STEP 1: Resolve baseline stored post-item-discount values for all lines
  // -------------------------------------------------------------------------
  const resolvedLines: ResolvedOriginalPurchaseLine[] = originalItems.map((orig) => {
    const origQty = Math.max(1, Number(orig.quantity) || 1);
    const unitCost = Math.max(0, Number(orig.costPrice ?? orig.unitPrice ?? orig.price ?? 0));
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
      // Tax-inclusive purchase pricing
      const grossAfterItemDisc = Math.max(0, unitCost * origQty - itemDiscount);
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
      // Tax-exclusive purchase pricing
      const netPreTax = Math.max(0, unitCost * origQty - itemDiscount);
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
      unitCost,
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
  const totalPurchaseDiscount = Number(purchaseContext?.totalDiscount ?? totalItemDiscounts);
  const billDiscount = Math.max(0, round2(totalPurchaseDiscount - totalItemDiscounts));
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

  if (purchaseContext?.pastReturns && Array.isArray(purchaseContext.pastReturns)) {
    for (const past of purchaseContext.pastReturns) {
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

  const totalPurchaseQty = resolvedLines.reduce((sum, l) => sum + l.origQty, 0);
  const totalPastReturnedQty = Array.from(pastReturnedQtyMap.values()).reduce((sum, q) => sum + q, 0);
  const totalCurrentRequestedQty = returnRequests.reduce((sum, r) => sum + Math.max(0, Number(r.quantity) || 0), 0);

  const isFullPurchaseReturn =
    totalPastReturnedQty === 0 && totalCurrentRequestedQty === totalPurchaseQty && returnRequests.length === originalItems.length;

  const isFinalReturnCompletingPurchase =
    totalPastReturnedQty > 0 && totalPastReturnedQty + totalCurrentRequestedQty === totalPurchaseQty;

  // -------------------------------------------------------------------------
  // STEP 4: Compute proportional return amount for each requested line
  // -------------------------------------------------------------------------
  const computedLines: ComputedReturnedPurchaseLine[] = [];
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
      throw new Error(`Item ${req.productName || req.productId || 'unknown'} not found in original purchase`);
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
      unitCost: matched.unitCost,
      taxRate: matched.taxRate,
      taxableAmount: lineTaxable,
      gstAmount: lineGst,
      refundAmount: lineRefund,
    });

    subtotal = round2(subtotal + lineTaxable);
    totalTax = round2(totalTax + lineGst);
    totalRefund = round2(totalRefund + lineRefund);
  }

  // -------------------------------------------------------------------------
  // STEP 5: Reconciliation against stored purchase figures (Invariants 1 & 4)
  // -------------------------------------------------------------------------
  let finalRefundAmount = totalRefund;

  if (isFullPurchaseReturn && purchaseContext?.grandTotal !== undefined && purchaseContext.grandTotal > 0) {
    // Invariant 1: Full return must refund EXACTLY Purchase.grandTotal
    finalRefundAmount = purchaseContext.grandTotal;
    subtotal = Number(purchaseContext.subtotal ?? subtotal);
    totalTax = Number(purchaseContext.totalTax ?? totalTax);

    // Reconcile line items so sum matches exact stored figures
    const refundDiff = round2(finalRefundAmount - totalRefund);
    const taxableDiff = round2(subtotal - computedLines.reduce((s, l) => s + l.taxableAmount, 0));
    const taxDiff = round2(totalTax - computedLines.reduce((s, l) => s + l.gstAmount, 0));

    if (computedLines.length > 0) {
      const primaryLine = computedLines.reduce((prev, curr) => (curr.refundAmount > prev.refundAmount ? curr : prev), computedLines[0]);
      primaryLine.refundAmount = round2(primaryLine.refundAmount + refundDiff);
      primaryLine.taxableAmount = round2(primaryLine.taxableAmount + taxableDiff);
      primaryLine.gstAmount = round2(primaryLine.gstAmount + taxDiff);
    }
  } else if (isFinalReturnCompletingPurchase && purchaseContext?.grandTotal !== undefined && purchaseContext.grandTotal > 0) {
    // Invariant 4: Absorbs any cumulative fractional paise drift on the last partial return
    const remainingBalance = Math.max(0, round2(purchaseContext.grandTotal - pastTotalRefunded));
    const drift = round2(remainingBalance - totalRefund);
    if (Math.abs(drift) > 0 && Math.abs(drift) <= 1.0 && computedLines.length > 0) {
      finalRefundAmount = remainingBalance;
      const primaryLine = computedLines.reduce((prev, curr) => (curr.refundAmount > prev.refundAmount ? curr : prev), computedLines[0]);
      primaryLine.refundAmount = round2(primaryLine.refundAmount + drift);
      primaryLine.taxableAmount = round2(primaryLine.taxableAmount + drift);
      subtotal = round2(subtotal + drift);
    }
  }

  return {
    items: computedLines,
    subtotal: round2(subtotal),
    totalTax: round2(totalTax),
    refundAmount: round2(finalRefundAmount),
  };
}
