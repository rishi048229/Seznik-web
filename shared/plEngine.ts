/**
 * Pure accounting calculation engine for Profit & Loss (P&L) statements.
 * Adheres to Section 15 CGST Act & standard Indian retail accounting practices.
 */

export interface PLInput {
  /** Total invoiced amount including all taxes and charges (grandTotal) */
  grossBilled: number;
  /** Total Output GST collected across all invoices (totalTax) */
  taxCollected: number;
  /** Realized returns/refunds deducted (0 until formal returns module) */
  returnsDeducted?: number;
  /** Total Cost of Goods Sold (COGS) */
  totalCost: number;
  /** Total operating expenses for the period */
  totalExpenses: number;
}

export interface PLOutput {
  grossBilled: number;
  taxCollected: number;
  returnsDeducted: number;
  netRevenue: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Computes cascading P&L statement metrics.
 *
 * Waterfall:
 * 1. Gross Billed (Total Invoiced)
 * 2. Less: Returns Deducted
 * 3. Less: GST Output Tax Collected
 * 4. = Net Revenue (Taxable Sales)
 * 5. Less: Cost of Goods Sold (COGS)
 * 6. = Gross Profit (Gross Margin %)
 * 7. Less: Operating Expenses
 * 8. = Net Operating Profit (Net Margin %)
 */
export function computePLMetrics(input: PLInput): PLOutput {
  const grossBilled = round2(input.grossBilled || 0);
  const taxCollected = round2(input.taxCollected || 0);
  const returnsDeducted = round2(input.returnsDeducted || 0);
  const totalCost = round2(input.totalCost || 0);
  const totalExpenses = round2(input.totalExpenses || 0);

  // Net Revenue = Gross Billed - Returns - GST Output Tax Collected
  const netRevenue = round2(grossBilled - returnsDeducted - taxCollected);

  // Gross Profit = Net Revenue - COGS
  const grossProfit = round2(netRevenue - totalCost);
  const grossMarginPercent = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;

  // Net Profit = Gross Profit - Operating Expenses
  const netProfit = round2(grossProfit - totalExpenses);
  const netMarginPercent = netRevenue > 0 ? round2((netProfit / netRevenue) * 100) : 0;

  return {
    grossBilled,
    taxCollected,
    returnsDeducted,
    netRevenue,
    totalRevenue: grossBilled, // Backward compatibility alias
    totalCost,
    grossProfit,
    grossMarginPercent,
    totalExpenses,
    netProfit,
    netMarginPercent,
  };
}

/**
 * Validates the core structural invoice reconciliation invariant:
 * (subtotal - billDiscount) + totalTax + extraChargesTotal === grandTotal
 *
 * Note: subtotal already excludes item-level discounts, so subtracting billDiscount
 * avoids double-counting discounts.
 */
export function validateInvoiceReconciliation(invoice: {
  subtotal: number;
  billDiscount?: number;
  totalTax: number;
  extraChargesTotal?: number;
  grandTotal: number;
}): { isValid: boolean; expectedGrandTotal: number; difference: number } {
  const subtotal = round2(invoice.subtotal || 0);
  const billDiscount = round2(invoice.billDiscount || 0);
  const totalTax = round2(invoice.totalTax || 0);
  const extraCharges = round2(invoice.extraChargesTotal || 0);
  const grandTotal = round2(invoice.grandTotal || 0);

  const expectedGrandTotal = round2(subtotal - billDiscount + totalTax + extraCharges);
  const difference = round2(Math.abs(expectedGrandTotal - grandTotal));

  return {
    isValid: difference <= 0.05, // Allow fractional rounding tolerance of up to 5 paise
    expectedGrandTotal,
    difference,
  };
}
