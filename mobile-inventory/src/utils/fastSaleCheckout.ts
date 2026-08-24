import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import { getTemplateById } from '@/constants/receiptTemplates';
import { CustomReceiptTemplate } from '@/types/customReceipt';

/** Local invoice number used on the receipt while the server assigns the real one in the background. */
export function generateProvisionalInvoice(): string {
  return `INV-${Date.now().toString().slice(-8)}`;
}

export function buildReceiptPrintOptions(input: {
  activeTemplateId: string;
  customTemplates: CustomReceiptTemplate[];
  activeCustomTemplateId: string | null;
  enableBillQrCode: boolean;
  topMargin: number;
  autoCut: boolean;
  fontSize: 'small' | 'medium' | 'large';
  printCopies: number;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  storeLogoUrl?: string;
  upiId?: string;
}): ReceiptPrintOptions {
  const activeCustomTemplate =
    input.customTemplates.find((t) => t.id === input.activeCustomTemplateId) || null;

  return {
    template: getTemplateById(input.activeTemplateId),
    customTemplate: activeCustomTemplate,
    includeBillQr: input.enableBillQrCode,
    topMargin: input.topMargin,
    autoCut: input.autoCut,
    fontSize: input.fontSize,
    copies: input.printCopies,
    storeName: input.storeName,
    storeAddress: input.storeAddress,
    storePhone: input.storePhone,
    storeGstin: input.storeGstin,
    storeLogoUrl: input.storeLogoUrl,
    upiId: input.upiId,
  };
}

/** Fire-and-forget thermal print — never blocks checkout on network I/O. */
export function printSaleReceiptNow(
  saleData: PrintSaleData,
  paperWidth: '58mm' | '80mm',
  options: ReceiptPrintOptions
): void {
  ThermalPrinterService.printSaleReceipt(saleData, { paperWidth, ...options }).catch((err) => {
    console.warn('[fastSaleCheckout] print failed:', err);
  });
}
