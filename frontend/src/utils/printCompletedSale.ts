import type { Sale } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt, resolveEffectiveReceiptConfig } from './receipt'
import { shouldPrintThermalOverBle, type BlePrinterLike } from './printTarget'
import { resolveThermalPaper } from './printerThermal'

export type { BlePrinterLike }

export const shouldAutoPrint = (settings?: UserSettings | null) =>
  settings?.printerConfig?.autoPrintOnSale !== false

export const thermalWidth = (paperSize?: string): '50mm' | '80mm' =>
  paperSize === '80mm' ? '80mm' : '50mm'

export const printCompletedSale = async (args: {
  sale: Sale
  settings?: UserSettings | null
  customerName?: string
  ble: BlePrinterLike
  onDone?: () => void
  /** When true, only print over Bluetooth. Used when the format picker is also shown. */
  skipBrowserFallback?: boolean
}): Promise<void> => {
  const { sale, settings, customerName, ble, onDone, skipBrowserFallback } = args
  const effectiveCustomerName = (customerName || (sale as any)?.customerName || (sale as any)?.customer?.name || 'Walk-in Customer').trim() || 'Walk-in Customer'
  const receiptConfig = resolveEffectiveReceiptConfig(settings)
  const paperSize = resolveThermalPaper(settings?.printerConfig)
  const width = thermalWidth(paperSize)
  const preferBle = shouldPrintThermalOverBle(settings, ble)

  const effectiveCustomerPhone = ((sale as any)?.customerPhone || (sale as any)?.customer?.phone || '').trim() || undefined

  if (preferBle) {
    try {
      if (ble.status !== 'connected') {
        await ble.connect()
      }
      const bytes = await generateReceiptEscPos({
        sale,
        receiptConfig,
        paperSize,
        printerConfig: settings?.printerConfig,
        receiptFont: settings?.printerConfig?.receiptFont,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        businessPhone: settings?.businessPhone,
        businessGSTIN: settings?.businessGSTIN,
        businessLogoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
        customerName: effectiveCustomerName,
        customerPhone: effectiveCustomerPhone,
      })
      await ble.print(bytes)
      onDone?.()
      return
    } catch {
      if (skipBrowserFallback) return
    }
  }

  if (skipBrowserFallback) return

  const html = generateReceiptHTML({
    sale,
    receiptConfig,
    printerConfig: settings?.printerConfig,
    businessName: settings?.businessName,
    businessAddress: settings?.businessAddress,
    businessPhone: settings?.businessPhone,
    businessGSTIN: settings?.businessGSTIN,
    customerName: effectiveCustomerName,
    customerPhone: effectiveCustomerPhone,
    width,
    logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
    settingsTaxName: 'GST',
  })
  printReceipt(html, width, sale.invoiceNumber, onDone, settings?.printerConfig?.receiptFont)
}
