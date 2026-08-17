export interface CalculateBillTotalsParams {
  items: { qty: number; unitPrice: number }[];
  gstMode: 'inclusive' | 'exclusive';
  gstRate: number;
  discount: { type: 'flat' | 'percent'; value: number };
}

export function calculateBillTotals({
  items,
  gstMode,
  gstRate,
  discount,
}: CalculateBillTotalsParams) {
  // Raw subtotal from items
  const rawSubtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  // Discount applied to subtotal before tax
  let discountAmount = 0;
  if (discount.type === 'flat') {
    discountAmount = discount.value;
  } else if (discount.type === 'percent') {
    discountAmount = (rawSubtotal * discount.value) / 100;
  }
  
  // Ensure discount doesn't exceed subtotal
  discountAmount = Math.min(discountAmount, rawSubtotal);
  const discountedSubtotal = rawSubtotal - discountAmount;

  let taxAmount = 0;
  let total = 0;

  if (gstMode === 'inclusive') {
    // If inclusive, the entered prices (and thus discountedSubtotal) ALREADY contain the GST.
    // Total = discountedSubtotal
    // Subtotal (excl tax) = Total / (1 + gstRate/100)
    // Tax = Total - Subtotal
    total = Math.max(0, discountedSubtotal);
    const subtotalExclTax = total / (1 + gstRate / 100);
    taxAmount = total - subtotalExclTax;
  } else {
    // If exclusive, the GST is added on top of the discountedSubtotal.
    taxAmount = discountedSubtotal * (gstRate / 100);
    total = Math.max(0, discountedSubtotal + taxAmount);
  }

  return {
    rawSubtotal,
    discountAmount,
    taxAmount,
    total,
  };
}
