import type { Sale } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt, resolveEffectiveReceiptConfig } from './receipt'

type BleLike = {
  status: string
  connect: () => Promise<void>
  print: (bytes: Uint8Array) => Promise<void>
}

export const shouldAutoPrint = (settings?: UserSettings | null) =>
  settings?.printerConfig?.autoPrintOnSale !== false

export const thermalWidth = (paperSize?: string): '50mm' | '80mm' =>
  paperSize === '80mm' ? '80mm' : '50mm'

export const printCompletedSale = async (args: {
  sale: Sale
  settings?: UserSettings | null
  customerName?: string
  ble: BleLike
  onDone?: () => void
}): Promise<void> => {
  const { sale, settings, customerName, ble, onDone } = args
  const receiptConfig = resolveEffectiveReceiptConfig(settings)
  const paperSize = settings?.printerConfig?.paperSize || '58mm'
  const width = thermalWidth(paperSize)
  const preferBle =
    settings?.printerConfig?.connectionType === 'bluetooth' && ble.status === 'connected'

  if (preferBle) {
    try {
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
      // Browser print is the fallback when Bluetooth fails.
    }
  }

  const html = generateReceiptHTML({
    sale,
    receiptConfig,
    businessName: settings?.businessName,
    businessAddress: settings?.businessAddress,
    customerName,
    width,
    logoURL: settings?.businessLogoURL || receiptConfig?.logoURL,
    settingsTaxName: 'GST',
  })
  printReceipt(html, width, sale.invoiceNumber, onDone)
}
