import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import { getTemplateById } from '@/constants/receiptTemplates';
import { CustomReceiptTemplate } from '@/types/customReceipt';
import { parseGstBilling, gstPrintOptionOverrides } from '@/constants/gstBilling';
import { resolveStoreProfile } from '@/hooks/useStoreProfile';
import { resolveStoreLogoUrl, resolveSettingsFooterMessage } from '@/utils/receiptLogo';
import type { ReceiptSizeChip } from '@shared/receiptPrintGeometry';
import type { ReceiptFontId } from '@shared/receiptFonts';
import type { UserProfile } from '@/types/auth';

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
  receiptFont?: ReceiptFontId;
  compactMode?: boolean;
  printCopies: number;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  storeLogoUrl?: string;
  upiId?: string;
  footerMessage?: string;
  showTaxBreakdown?: boolean;
  itemWiseGst?: boolean;
  receiptLogoSize?: ReceiptSizeChip;
  receiptQrSize?: ReceiptSizeChip;
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
    receiptFont: input.receiptFont,
    compactMode: input.compactMode,
    copies: input.printCopies,
    storeName: input.storeName,
    storeAddress: input.storeAddress,
    storePhone: input.storePhone,
    storeGstin: input.storeGstin,
    storeLogoUrl: input.storeLogoUrl,
    upiId: input.upiId,
    footerMessage: input.footerMessage,
    showTaxBreakdown: input.showTaxBreakdown,
    itemWiseGst: input.itemWiseGst,
    receiptLogoSize: input.receiptLogoSize,
    receiptQrSize: input.receiptQrSize,
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

type SettingsLike = {
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessGSTIN?: string | null;
  businessLogoURL?: string | null;
  upiId?: string | null;
  receiptConfig?: Record<string, unknown> | null;
  invoiceConfig?: unknown;
} | null | undefined;

export function resolveSettingsLogoUrl(settings: SettingsLike): string | undefined {
  return resolveStoreLogoUrl(settings?.receiptConfig, settings?.businessLogoURL);
}

/** Sample sale used by every test-print button (Printers, builder, editor, dashboard). */
export function buildSampleTestSale(
  settings: SettingsLike,
  overrides: Partial<PrintSaleData> = {},
  user?: UserProfile | null
): PrintSaleData {
  const profile = resolveStoreProfile(settings as any, user);
  return {
    storeName: profile.storeName,
    storeAddress: profile.storeAddress,
    storePhone: profile.storePhone,
    storeGstin: profile.storeGstin,
    storeLogoUrl: profile.storeLogoUrl,
    upiId: profile.upiId,
    footerMessage: profile.footerMessage,
    invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toLocaleDateString('en-GB'),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    customerName: 'Walk-in Customer',
    customerPhone: '9988776655',
    items: [
      { productName: 'Basmati Rice 5kg', quantity: 1, unitPrice: 450.0, total: 450.0, unit: 'Bag', gstRate: 5 },
      { productName: 'Sunflower Oil 1L', quantity: 2, unitPrice: 180.0, total: 360.0, unit: 'Btl', gstRate: 5 },
      { productName: 'Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280.0, total: 280.0, unit: 'Bag', gstRate: 0 },
    ],
    subtotal: 1090,
    totalDiscount: 0,
    totalTax: 40.5,
    grandTotal: 1130.5,
    amountPaid: 1130.5,
    changeReturned: 0,
    paymentMethod: 'CASH',
    ...overrides,
  };
}

import { useAuthStore } from '@/store/useAuthStore';

/** Print options for test receipts — same calibration/logo/GST/footer as a real POS sale. */
export function buildTestReceiptPrintOptions(input: {
  activeTemplateId: string;
  customTemplates: CustomReceiptTemplate[];
  activeCustomTemplateId: string | null;
  enableBillQrCode: boolean;
  topMargin: number;
  autoCut: boolean;
  fontSize: 'small' | 'medium' | 'large';
  receiptFont?: ReceiptFontId;
  compactMode?: boolean;
  receiptLogoSize?: ReceiptSizeChip;
  receiptQrSize?: ReceiptSizeChip;
  settings: SettingsLike;
  customTemplate?: CustomReceiptTemplate | null;
  copies?: number;
  user?: UserProfile | null;
}): ReceiptPrintOptions {
  const currentUser = input.user ?? useAuthStore.getState().user;
  const profile = resolveStoreProfile(input.settings as any, currentUser);
  const gst = gstPrintOptionOverrides(parseGstBilling(input.settings?.invoiceConfig));
  const logo = profile.storeLogoUrl || resolveSettingsLogoUrl(input.settings);
  const footerMessage = profile.footerMessage || resolveSettingsFooterMessage(input.settings?.receiptConfig);
  const receiptConfig = input.settings?.receiptConfig as Record<string, any> | undefined;
  const receiptLogoSize = input.receiptLogoSize || receiptConfig?.receiptLogoSize;
  const receiptQrSize = input.receiptQrSize || receiptConfig?.receiptQrSize;
  const options = buildReceiptPrintOptions({
    activeTemplateId: input.activeTemplateId,
    customTemplates: input.customTemplates,
    activeCustomTemplateId: input.activeCustomTemplateId,
    enableBillQrCode: input.enableBillQrCode,
    topMargin: input.topMargin,
    autoCut: input.autoCut,
    fontSize: input.fontSize,
    receiptFont: input.receiptFont,
    compactMode: input.compactMode,
    printCopies: input.copies ?? 1,
    storeName: profile.storeName,
    storeAddress: profile.storeAddress,
    storePhone: profile.storePhone,
    storeGstin: profile.storeGstin,
    storeLogoUrl: logo,
    upiId: profile.upiId,
    footerMessage,
    receiptLogoSize,
    receiptQrSize,
    ...gst,
  });
  if (input.customTemplate !== undefined) {
    options.customTemplate = input.customTemplate;
  }
  return options;
}

