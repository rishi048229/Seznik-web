export type GstBreakdownStyle = 'compact' | 'tax_invoice' | 'slab_wise'

export interface GstBillingConfig {
  configured: boolean
  showBreakdown: boolean
  style: GstBreakdownStyle
  printOnReceipt: boolean
  itemWiseGst: boolean
}

export interface ReceiptPrintGstOptions {
  showTaxBreakdown: boolean
  gstStyle: GstBreakdownStyle | undefined
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

export function shouldShowGstBreakdown(config: GstBillingConfig): boolean {
  return config.showBreakdown && config.style !== 'compact'
}

export function shouldPrintGstBreakdown(config: GstBillingConfig, templateFlag: boolean): boolean {
  if (!config.configured) return templateFlag
  return config.printOnReceipt
}

export function gstPrintOptionOverrides(config: GstBillingConfig): {
  showTaxBreakdown?: boolean
  itemWiseGst?: boolean
} {
  if (!config.configured) return {}
  return {
    showTaxBreakdown: config.printOnReceipt,
    itemWiseGst: config.itemWiseGst,
  }
}

export function printGstStyle(config: GstBillingConfig): GstBreakdownStyle | undefined {
  return config.printOnReceipt ? config.style : undefined
}

/** Resolve GST print display from invoiceConfig.gstBilling with legacy receiptConfig fallback. */
export function resolveReceiptPrintGst(
  invoiceConfig: unknown,
  receiptConfig?: { showTaxBreakdown?: boolean } | null
): ReceiptPrintGstOptions {
  const gst = parseGstBilling(invoiceConfig)
  const legacyFlag = receiptConfig?.showTaxBreakdown ?? true

  if (!gst.configured) {
    return {
      showTaxBreakdown: legacyFlag,
      gstStyle: legacyFlag ? 'tax_invoice' : undefined,
      itemWiseGst: legacyFlag,
    }
  }

  const showTaxBreakdown = shouldPrintGstBreakdown(gst, legacyFlag)
  return {
    showTaxBreakdown,
    gstStyle: printGstStyle(gst),
    itemWiseGst: gst.itemWiseGst,
  }
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
