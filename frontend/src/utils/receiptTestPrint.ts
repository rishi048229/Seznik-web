import type { Sale } from '@/types/sale.types'
import type { ReceiptConfig } from '@/types/settings.types'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { SAMPLE_RECEIPT_CONTEXT } from '@/utils/customReceiptEngine'
import { resolveActiveFromTemplates, ensureTemplateHasLogoBlock } from '@/utils/ensureReceiptTemplates'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt } from '@/utils/receipt'
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
  businessName?: string
  businessAddress?: string
  customerName?: string
  logoURL?: string
  businessLogoURL?: string
  invoiceConfig?: unknown
  connectionType: 'bluetooth' | 'system_driver'
  bleConnected: boolean
}

export async function runReceiptTemplateTestPrint({
  sale,
  receiptConfig,
  customTemplates,
  templateId,
  templateDraft,
  paperSize = '58mm',
  businessName,
  businessAddress,
  customerName,
  logoURL,
  businessLogoURL,
  invoiceConfig,
  connectionType,
  bleConnected,
}: RunReceiptTemplateTestPrintParams): Promise<'ble' | 'browser'> {
  const resolvedLogo = resolveStoreLogoUrl(receiptConfig, businessLogoURL || logoURL)
  const rawTemplate = resolveTemplateForPrint(customTemplates, templateId, templateDraft)
  const printableLogo = await prefetchPrintableLogoSrc(resolvedLogo)
  const logoForPrint = printableLogo || resolvedLogo
  const template = rawTemplate ? ensureTemplateHasLogoBlock(rawTemplate, logoForPrint) : null
  const effectiveConfig = {
    ...buildReceiptConfigForTemplate(receiptConfig, customTemplates, templateId, template ?? templateDraft),
    ...(logoForPrint ? { logoURL: logoForPrint } : {}),
  }
  const effectivePaper = (template?.paperWidth || paperSize) as '58mm' | '80mm'

  if (connectionType === 'bluetooth' && bleConnected) {
    const bytes = await generateReceiptEscPos({
      sale,
      receiptConfig: effectiveConfig,
      paperSize: effectivePaper,
      businessName,
      businessAddress,
      customerName,
      templateOverride: template ?? undefined,
      businessLogoURL: logoForPrint || businessLogoURL || logoURL,
      invoiceConfig,
    })
    await printEscPos(bytes)
    return 'ble'
  }

  const receiptHTML = generateReceiptHTML({
    sale,
    receiptConfig: effectiveConfig,
    businessName,
    businessAddress,
    customerName: customerName || SAMPLE_RECEIPT_CONTEXT.customerName,
    width: effectivePaper === '80mm' ? '80mm' : '50mm',
    logoURL: logoForPrint || logoURL || receiptConfig.logoURL,
    settingsTaxName: 'GST',
    templateOverride: template ?? undefined,
    invoiceConfig,
  })
  printReceipt(receiptHTML, effectivePaper === '80mm' ? '80mm' : '50mm', 'Test Receipt')
  return 'browser'
}
