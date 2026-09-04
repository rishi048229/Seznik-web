import type { Sale } from '@/types/sale.types'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { SAMPLE_RECEIPT_CONTEXT } from '@/utils/customReceiptEngine'
import { resolveActiveFromTemplates, ensureTemplateHasLogoBlock } from '@/utils/ensureReceiptTemplates'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { printEscPos } from '@/utils/blePrinter'
import { prefetchPrintableLogoSrc, resolveStoreLogoUrl } from '@/utils/receiptLogo'

export function buildReceiptConfigForTemplate(
  receiptConfig: Partial<ReceiptConfig>,
  customTemplates: CustomReceiptTemplate[],
  templateId: string,
  templateDraft?: CustomReceiptTemplate
): Partial<ReceiptConfig> {
  const tpl = templateDraft ?? customTemplates.find((t) => t.id === templateId)
  const mergedTemplates = tpl
    ? customTemplates.map((t) => (t.id === tpl.id ? tpl : t))
    : customTemplates
  return {
    ...receiptConfig,
    customTemplates: mergedTemplates,
    activeCustomTemplateId: templateId,
  }
}

export function resolveTemplateForPrint(
  customTemplates: CustomReceiptTemplate[],
  templateId: string | null | undefined,
  templateDraft?: CustomReceiptTemplate
): CustomReceiptTemplate | null {
  if (templateDraft) return templateDraft
  if (templateId) {
    const match = customTemplates.find((t) => t.id === templateId)
    if (match) return match
  }
  return resolveActiveFromTemplates(customTemplates, templateId)
}

export function sampleTestSaleFromContext(): Sale {
  return {
    id: 'test',
    invoiceNumber: SAMPLE_RECEIPT_CONTEXT.invoiceNumber,
    items: SAMPLE_RECEIPT_CONTEXT.items.map((it, i) => ({
      id: String(i),
      productName: it.productName,
      quantity: it.quantity,
      sellingPrice: it.unitPrice,
      total: it.total,
      taxRate: it.gstRate ?? 0,
      discount: 0,
      taxAmount: 0,
    })),
    subtotal: SAMPLE_RECEIPT_CONTEXT.subtotal,
    totalDiscount: SAMPLE_RECEIPT_CONTEXT.totalDiscount,
    totalTax: SAMPLE_RECEIPT_CONTEXT.totalTax,
    grandTotal: SAMPLE_RECEIPT_CONTEXT.grandTotal,
    amountPaid: SAMPLE_RECEIPT_CONTEXT.amountPaid ?? SAMPLE_RECEIPT_CONTEXT.grandTotal,
    changeReturned: SAMPLE_RECEIPT_CONTEXT.changeReturned ?? 0,
    paymentMethod: 'upi',
    isQuickBill: false,
    createdAt: new Date().toISOString(),
  } as Sale
}

interface RunReceiptTemplateTestPrintParams {
  sale: Sale
  receiptConfig: Partial<ReceiptConfig>
  customTemplates: CustomReceiptTemplate[]
  templateId: string
  templateDraft?: CustomReceiptTemplate
  paperSize?: '58mm' | '80mm'
  /** Full settings row — same merge POS uses so logo/phone/address/UPI match a real bill. */
  settings?: Partial<UserSettings> | null
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessGSTIN?: string
  customerName?: string
  logoURL?: string
  businessLogoURL?: string
  invoiceConfig?: unknown
  connectionType: 'bluetooth' | 'system_driver'
  bleConnected: boolean
  isRestaurant?: boolean
  /** Unsaved Printers-page selection — preferred over settings.printerConfig.receiptFont. */
  receiptFont?: import('@shared/receiptFonts').ReceiptFontId | string | null
}

export async function runReceiptTemplateTestPrint({
  sale,
  receiptConfig,
  customTemplates,
  templateId,
  templateDraft,
  paperSize = '58mm',
  settings,
  businessName,
  businessAddress,
  businessPhone,
  businessGSTIN,
  customerName,
  logoURL,
  businessLogoURL,
  invoiceConfig,
  connectionType,
  bleConnected,
  isRestaurant,
  receiptFont,
}: RunReceiptTemplateTestPrintParams): Promise<'ble' | 'browser'> {
  const mergedReceipt = resolveEffectiveReceiptConfig(settings, {
    ...receiptConfig,
    customTemplates,
    activeCustomTemplateId: templateId,
  })
  const resolvedLogo = resolveStoreLogoUrl(
    mergedReceipt,
    businessLogoURL || logoURL || settings?.businessLogoURL
  )
  const rawTemplate = resolveTemplateForPrint(customTemplates, templateId, templateDraft)
  const printableLogo = await prefetchPrintableLogoSrc(resolvedLogo)
  const logoForPrint = printableLogo || resolvedLogo
  const template = rawTemplate ? ensureTemplateHasLogoBlock(rawTemplate, logoForPrint) : null
  const effectiveConfig = {
    ...buildReceiptConfigForTemplate(mergedReceipt, customTemplates, templateId, template ?? templateDraft),
    ...(logoForPrint ? { logoURL: logoForPrint } : {}),
  }
  const effectivePaper = (template?.paperWidth || paperSize) as '58mm' | '80mm'
  const printerConfig = settings?.printerConfig
  const effectiveReceiptFont = receiptFont ?? printerConfig?.receiptFont
  const identity = {
    businessName: businessName || mergedReceipt.companyName || settings?.businessName,
    businessAddress: businessAddress || mergedReceipt.address || settings?.businessAddress,
    businessPhone: businessPhone || mergedReceipt.phone || settings?.businessPhone,
    businessGSTIN: businessGSTIN || mergedReceipt.gstin || settings?.businessGSTIN,
    isRestaurant,
    ...(isRestaurant
      ? { tableNo: '12', tokenNo: '42', waiterName: 'RAJ' }
      : {}),
  }

  if (connectionType === 'bluetooth' && bleConnected) {
    const bytes = await generateReceiptEscPos({
      sale,
      receiptConfig: effectiveConfig,
      paperSize: effectivePaper,
      printerConfig,
      receiptFont: effectiveReceiptFont,
      ...identity,
      customerName,
      templateOverride: template ?? undefined,
      businessLogoURL: logoForPrint || businessLogoURL || logoURL || settings?.businessLogoURL,
      invoiceConfig: invoiceConfig ?? settings?.invoiceConfig,
    })
    await printEscPos(bytes)
    return 'ble'
  }

  const receiptHTML = generateReceiptHTML({
    sale,
    receiptConfig: effectiveConfig,
    printerConfig,
    receiptFont: effectiveReceiptFont,
    ...identity,
    customerName: customerName || SAMPLE_RECEIPT_CONTEXT.customerName,
    width: effectivePaper === '80mm' ? '80mm' : '50mm',
    logoURL: logoForPrint || logoURL || mergedReceipt.logoURL || settings?.businessLogoURL,
    settingsTaxName: 'GST',
    templateOverride: template ?? undefined,
    invoiceConfig: invoiceConfig ?? settings?.invoiceConfig,
  })
  printReceipt(receiptHTML, effectivePaper === '80mm' ? '80mm' : '50mm', 'Test Receipt')
  return 'browser'
}
