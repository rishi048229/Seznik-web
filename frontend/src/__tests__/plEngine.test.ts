import { describe, it, expect } from 'vitest';
import { computePLMetrics, validateInvoiceReconciliation } from '@shared/plEngine';
import { calculateGstBill, type BillInput } from '@shared/gstTaxEngine';

describe('P&L Engine & GST Revenue Decoupling', () => {
  // -------------------------------------------------------------------------
  // 1. Accounting Invariants
  // -------------------------------------------------------------------------
  it('strictly satisfies Invariant 1: netRevenue + taxCollected + returnsDeducted === grossBilled', () => {
    const pl = computePLMetrics({
      grossBilled: 118000,
      taxCollected: 18000,
      returnsDeducted: 0,
      totalCost: 60000,
      totalExpenses: 15000,
    });

    expect(pl.netRevenue + pl.taxCollected + pl.returnsDeducted).toBe(pl.grossBilled);
    expect(pl.netRevenue).toBe(100000);
    expect(pl.totalRevenue).toBe(118000); // Backward compatibility
  });

  it('strictly satisfies Invariant 2: grossProfit === netRevenue - totalCost', () => {
    const pl = computePLMetrics({
      grossBilled: 118000,
      taxCollected: 18000,
      returnsDeducted: 0,
      totalCost: 60000,
      totalExpenses: 15000,
    });

    expect(pl.grossProfit).toBe(pl.netRevenue - pl.totalCost);
    expect(pl.grossProfit).toBe(40000);
    expect(pl.grossMarginPercent).toBe(40); // 40,000 / 100,000 * 100
  });

  it('strictly satisfies Invariant 3: netProfit === grossProfit - totalExpenses', () => {
    const pl = computePLMetrics({
      grossBilled: 118000,
      taxCollected: 18000,
      returnsDeducted: 0,
      totalCost: 60000,
      totalExpenses: 15000,
    });

    expect(pl.netProfit).toBe(pl.grossProfit - pl.totalExpenses);
    expect(pl.netProfit).toBe(25000);
    expect(pl.netMarginPercent).toBe(25); // 25,000 / 100,000 * 100
  });

  // -------------------------------------------------------------------------
  // 2. Current Indian GST Slabs (0%, 5%, 18%, 40%)
  // -------------------------------------------------------------------------
  it('correctly calculates P&L metrics with current Indian GST slabs (0, 5, 18, 40)', () => {
    const bill: BillInput = {
      lineItems: [
        { name: 'Grains (0%)', price: 500, qty: 1, gstRate: 0, priceType: 'exclusive' },
        { name: 'Cooking Oil (5%)', price: 200, qty: 2, gstRate: 5, priceType: 'inclusive' }, // 400 gross -> 380.95 taxable + 19.05 GST
        { name: 'Packaged Food (18%)', price: 1000, qty: 1, gstRate: 18, priceType: 'exclusive' }, // 1000 taxable + 180 GST
        { name: 'Aerated / Luxury (40%)', price: 500, qty: 1, gstRate: 40, priceType: 'exclusive' }, // 500 taxable + 200 GST
      ],
      billDiscountAmount: 100,
      isIntraState: true,
    };

    const gstBill = calculateGstBill(bill);
    expect(gstBill.finalInvoiceTotal).toBeGreaterThan(0);

    const pl = computePLMetrics({
      grossBilled: gstBill.finalInvoiceTotal,
      taxCollected: gstBill.totalTax,
      returnsDeducted: 0,
      totalCost: 1200,
      totalExpenses: 300,
    });

    expect(pl.grossBilled).toBe(gstBill.finalInvoiceTotal);
    expect(pl.taxCollected).toBe(gstBill.totalTax);
    expect(pl.netRevenue).toBe(Math.round((gstBill.finalInvoiceTotal - gstBill.totalTax) * 100) / 100);
    expect(pl.netRevenue + pl.taxCollected).toBe(pl.grossBilled);
    expect(pl.grossProfit).toBe(Math.round((pl.netRevenue - 1200) * 100) / 100);
    expect(pl.netProfit).toBe(Math.round((pl.grossProfit - 300) * 100) / 100);
  });

  // -------------------------------------------------------------------------
  // 3. Legacy GST Slabs Playback (0%, 5%, 12%, 18%, 28%)
  // -------------------------------------------------------------------------
  it('correctly handles legacy historical invoices with 12% and 28% slabs', () => {
    const bill: BillInput = {
      lineItems: [
        { name: 'Legacy Processed (12%)', price: 1000, qty: 1, gstRate: 12, priceType: 'exclusive' }, // 1000 + 120 tax
        { name: 'Legacy Consumer Durable (28%)', price: 2000, qty: 1, gstRate: 28, priceType: 'exclusive' }, // 2000 + 560 tax
      ],
      isIntraState: true,
    };

    const gstBill = calculateGstBill(bill);
    expect(gstBill.totalTaxableValue).toBe(3000);
    expect(gstBill.totalTax).toBe(680);
    expect(gstBill.finalInvoiceTotal).toBe(3680);

    const pl = computePLMetrics({
      grossBilled: gstBill.finalInvoiceTotal,
      taxCollected: gstBill.totalTax,
      totalCost: 2000,
      totalExpenses: 400,
    });

    expect(pl.grossBilled).toBe(3680);
    expect(pl.taxCollected).toBe(680);
    expect(pl.netRevenue).toBe(3000);
    expect(pl.grossProfit).toBe(1000);
    expect(pl.netProfit).toBe(600);
  });

  // -------------------------------------------------------------------------
  // 4. Composition Scheme / Nil-Rated / 0% GST
  // -------------------------------------------------------------------------
  it('guarantees grossBilled === netRevenue and taxCollected === 0 when GST is 0', () => {
    const pl = computePLMetrics({
      grossBilled: 50000,
      taxCollected: 0,
      totalCost: 30000,
      totalExpenses: 8000,
    });

    expect(pl.grossBilled).toBe(50000);
    expect(pl.taxCollected).toBe(0);
    expect(pl.netRevenue).toBe(50000);
    expect(pl.grossProfit).toBe(20000);
    expect(pl.netProfit).toBe(12000);
  });

  // -------------------------------------------------------------------------
  // 5. Structural Reconciliation Invariant Check
  // -------------------------------------------------------------------------
  it('validates structural formula (subtotal - billDiscount) + totalTax + extraCharges === grandTotal', () => {
    const validInvoice = {
      subtotal: 1000, // post item discount, pre bill discount, tax exclusive
      billDiscount: 100,
      totalTax: 162, // 18% on 900
      extraChargesTotal: 50,
      grandTotal: 1112, // (1000 - 100) + 162 + 50 = 1112
    };

    const check = validateInvoiceReconciliation(validInvoice);
    expect(check.isValid).toBe(true);
    expect(check.expectedGrandTotal).toBe(1112);
    expect(check.difference).toBe(0);
  });

  it('detects structural anomalies when grandTotal does not reconcile', () => {
    const corruptedInvoice = {
      subtotal: 1000,
      billDiscount: 50,
      totalTax: 171,
      extraChargesTotal: 0,
      grandTotal: 1500, // Corrupted / arbitrary grandTotal
    };

    const check = validateInvoiceReconciliation(corruptedInvoice);
    expect(check.isValid).toBe(false);
    expect(check.expectedGrandTotal).toBe(1121);
    expect(check.difference).toBe(379);
  });

  // -------------------------------------------------------------------------
  // 6. IST Calendar-Day Boundary Handling
  // -------------------------------------------------------------------------
  it('correctly classifies a 11:45 PM IST sale within the same calendar day window', () => {
    // 2026-09-12 23:45:00 IST is 2026-09-12 18:15:00 UTC
    const istSaleDate = new Date('2026-09-12T18:15:00.000Z'); // 23:45 IST
    const istStartOfDay = new Date('2026-09-12T00:00:00.000+05:30');
    const istEndOfDay = new Date('2026-09-12T23:59:59.999+05:30');

    expect(istSaleDate.getTime()).toBeGreaterThanOrEqual(istStartOfDay.getTime());
    expect(istSaleDate.getTime()).toBeLessThanOrEqual(istEndOfDay.getTime());
  });
});
