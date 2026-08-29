import type { Sale } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt, resolveEffectiveReceiptConfig } from './receipt'
import { shouldPrintThermalOverBle, type BlePrinterLike } from './printTarget'

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
  const receiptConfig = resolveEffectiveReceiptConfig(settings)
  const paperSize = settings?.printerConfig?.paperSize || '58mm'
  const width = thermalWidth(paperSize)
  const preferBle = shouldPrintThermalOverBle(settings, ble)

  if (preferBle) {
    try {
      if (ble.status !== 'connected') {
        await ble.connect()
      }
      const bytes = await generateReceiptEscPos({
        sale,
        receiptConfig,
        paperSize,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName,
      })
      await ble.print(bytes)
      onDone?.()
      return
    } catch {
      if (skipBrowserFallback || preferBle) return
    }
  }

  if (skipBrowserFallback) return

  const html = generateReceiptHTML({
    sale,
    receiptConfig,
    printerConfig: settings?.printerConfig,
    businessName: settings?.businessName,
    businessAddress: settings?.businessAddress,
    customerName,
    width,
    logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
    settingsTaxName: 'GST',
  })
  printReceipt(html, width, sale.invoiceNumber, onDone)
}
