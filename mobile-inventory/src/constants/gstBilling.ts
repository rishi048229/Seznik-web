export type GstBreakdownStyle = 'compact' | 'tax_invoice' | 'slab_wise'

export interface GstBillingConfig {
  /** True when the merchant has saved this card at least once. */
  configured: boolean
  /** Show CGST/SGST (or slab-wise) on checkout and sale details. */
  showBreakdown: boolean
  style: GstBreakdownStyle
  /** Print the breakdown on thermal/A4 receipts. When not configured, the receipt template wins. */
  printOnReceipt: boolean
  /** Print each line's GST % under the item name. */
  itemWiseGst: boolean
}

export const DEFAULT_GST_BILLING: GstBillingConfig = {
  configured: false,
  showBreakdown: false,
  style: 'tax_invoice',
  printOnReceipt: false,
  itemWiseGst: false,
}

const STYLES: GstBreakdownStyle[] = ['compact', 'tax_invoice', 'slab_wise']

export function parseGstBilling(invoiceConfig: unknown): GstBillingConfig {
  const raw =
    invoiceConfig && typeof invoiceConfig === 'object'
      ? (invoiceConfig as { gstBilling?: Record<string, unknown> }).gstBilling
      : undefined

  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GST_BILLING }
  }

  const style = STYLES.includes(raw.style as GstBreakdownStyle)
    ? (raw.style as GstBreakdownStyle)
    : 'tax_invoice'

  const showBreakdown = Boolean(raw.showBreakdown)
  return {
    configured: true,
    showBreakdown,
    style,
    printOnReceipt: raw.printOnReceipt !== undefined ? Boolean(raw.printOnReceipt) : showBreakdown,
    itemWiseGst: Boolean(raw.itemWiseGst),
  }
}

export function toGstBillingPayload(config: Omit<GstBillingConfig, 'configured'>): Record<string, unknown> {
  return {
    showBreakdown: config.showBreakdown,
    style: config.style,
    printOnReceipt: config.printOnReceipt,
    itemWiseGst: config.itemWiseGst,
  }
}

/** Checkout / sale-detail should render the full GST table. */
export function shouldShowGstBreakdown(config: GstBillingConfig): boolean {
  return config.showBreakdown && config.style !== 'compact'
}

/**
 * Printed receipts: explicit setting overrides the receipt template.
 * Unconfigured stores keep whatever the template already does.
 */
export function shouldPrintGstBreakdown(config: GstBillingConfig, templateFlag: boolean): boolean {
  if (!config.configured) return templateFlag
  return config.printOnReceipt && config.style !== 'compact'
}

/** Attach to print options so receipts honor Tax & Billing even when the template is compact. */
export function gstPrintOptionOverrides(config: GstBillingConfig): {
  showTaxBreakdown?: boolean
  itemWiseGst?: boolean
} {
  if (!config.configured) return {}
  return {
    showTaxBreakdown: config.printOnReceipt && config.style !== 'compact',
    itemWiseGst: config.itemWiseGst,
  }
}

/** Style printed on the slip. Checkout UI uses `config.style` separately. */
export function printGstStyle(config: GstBillingConfig): GstBreakdownStyle | undefined {
  return config.printOnReceipt ? config.style : undefined
}

export const GST_BREAKDOWN_STYLE_OPTIONS: { value: GstBreakdownStyle; label: string; description: string }[] = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Single GST line — fastest slip for cafes and small tickets',
  },
  {
    value: 'tax_invoice',
    label: 'Tax Invoice',
    description: 'Taxable value + CGST + SGST — for GST-extra / base-price shops',
  },
  {
    value: 'slab_wise',
    label: 'Slab-wise',
    description: 'Group by GST rate — restaurants with 5% food and 18% packaged items',
  },
]
