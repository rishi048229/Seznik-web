import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import ThermalPrinterService, { PrintSaleData, ReceiptPrintOptions } from '@/services/PrinterService';
import type { Sale } from '@/types/sale';
import type { StoreProfile } from '@/hooks/useStoreProfile';
import type { Settings } from '@/api/settings';
import { computeGstBillSummary, gstLinesFromSaleItems } from '@/utils/gst';
import { parseGstBilling } from '@/constants/gstBilling';

type StoreProfileWithSettings = StoreProfile & { settings?: Settings | null };

const INVOICE_PDF_DIR = `${FileSystem.documentDirectory || ''}invoices/`;

/** Always overlay the latest saved store profile onto receipt data — sale records don't store header fields. */
export function applyStoreProfileToPrintData(data: PrintSaleData, storeProfile: StoreProfile): PrintSaleData {
  return {
    ...data,
    storeName: storeProfile.storeName,
    storeAddress: storeProfile.storeAddress,
    storePhone: storeProfile.storePhone,
    storeGstin: storeProfile.storeGstin,
    storeLogoUrl: storeProfile.storeLogoUrl,
    upiId: storeProfile.upiId,
    footerMessage: storeProfile.footerMessage,
  };
}

export function saleToPrintItems(sale: Sale) {
  return (sale.items || []).map((it: any) => ({
    productName: it.productName || it.name || 'Item',
    quantity: it.quantity || 1,
    unitPrice: it.unitPrice || it.price || 0,
    total: it.total || (it.quantity || 1) * (it.unitPrice || 0),
    unit: it.unit || 'piece',
    gstRate: it.gstRate || it.taxRate,
    discount: it.discountAmount || it.discount,
  }));
}

/** Build the same PrintSaleData shape POS uses so ReceiptPreviewModal renders identically. */
export function saleToPrintSaleData(sale: Sale, storeProfile: StoreProfileWithSettings): PrintSaleData {
  const totalTax = sale.totalTax || 0;
  const halfTax = totalTax / 2;
  const taxableAmt = Math.max(0, sale.subtotal - (sale.totalDiscount || 0));
  const gstBilling = parseGstBilling(storeProfile.settings?.invoiceConfig);
  const summary = computeGstBillSummary(gstLinesFromSaleItems(sale.items || []));

  return applyStoreProfileToPrintData(
    {
      storeName: '',
      storeAddress: '',
      storePhone: '',
      storeGstin: '',
      invoiceNumber: sale.invoiceNumber,
      date: formatInvoiceDateTime(sale.createdAt),
      customerName: sale.customerName || 'Walk-in Customer',
      items: saleToPrintItems(sale),
      subtotal: sale.subtotal,
      taxableAmt: summary.taxableValue || taxableAmt,
      sgst: summary.sgstAmount || halfTax,
      cgst: summary.cgstAmount || halfTax,
      gstStyle: gstBilling.printOnReceipt ? gstBilling.style : undefined,
      gstSlabs: summary.slabs,
      totalDiscount: sale.totalDiscount || 0,
      totalTax,
      billCharges: Array.isArray(sale.billCharges) ? sale.billCharges : undefined,
      extraChargesTotal: sale.extraChargesTotal || 0,
      grandTotal: sale.grandTotal,
      amountPaid: sale.amountPaid !== undefined ? sale.amountPaid : sale.grandTotal,
      changeReturned: sale.changeReturned || 0,
      paymentMethod: (sale.paymentMethod || 'cash').toUpperCase(),
    },
    storeProfile
  );
}

export function formatInvoiceDateTime(createdAt: string) {
  const d = new Date(createdAt);
  return (
    d.toLocaleDateString('en-GB') +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

export async function printInvoiceReceipt(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  paperWidth: '58mm' | '80mm',
  printOptions: ReceiptPrintOptions,
  connectionState?: string
): Promise<boolean> {
  if (connectionState !== 'connected') {
    return false;
  }

  const saleData = saleToPrintSaleData(sale, storeProfile);
  return ThermalPrinterService.printReceipt(saleData, paperWidth, printOptions);
}

/** @deprecated Use printInvoiceReceipt — kept for callers that used printSaleReceipt. */
export async function printInvoiceThermal(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  _onNeedPrinter?: () => void,
  connectionState?: string
): Promise<boolean> {
  return printInvoiceReceipt(sale, storeProfile, '58mm', {}, connectionState);
}

export async function saveInvoicePdfLocally(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  options: ReceiptPrintOptions = {}
): Promise<string> {
  const saleData = saleToPrintSaleData(sale, storeProfile);
  const html = ThermalPrinterService.generateA4InvoiceHtml(saleData, options);
  const { uri: tempUri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  await FileSystem.makeDirectoryAsync(INVOICE_PDF_DIR, { intermediates: true }).catch(() => {});

  const safeName = sale.invoiceNumber.replace(/[^\w.-]+/g, '_');
  const destUri = `${INVOICE_PDF_DIR}${safeName}.pdf`;

  try {
    const existing = await FileSystem.getInfoAsync(destUri);
    if (existing.exists) {
      await FileSystem.deleteAsync(destUri, { idempotent: true });
    }
  } catch {
    // ignore
  }

  await FileSystem.copyAsync({ from: tempUri, to: destUri });
  return destUri;
}

export async function openInvoicePdf(uri: string, invoiceNumber?: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: invoiceNumber ? `Invoice #${invoiceNumber}` : 'Invoice',
    });
    return;
  }

  Alert.alert('Invoice Saved', `PDF saved on this device:\n${uri}`);
}

/** Save the A4 invoice PDF, then open it immediately. */
export async function saveAndOpenInvoicePdf(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  options: ReceiptPrintOptions = {}
): Promise<string> {
  const destUri = await saveInvoicePdfLocally(sale, storeProfile, options);
  await openInvoicePdf(destUri, sale.invoiceNumber);
  return destUri;
}

/** Opens share sheet — prefer saveAndOpenInvoicePdf for on-device storage. */
export async function downloadInvoicePdf(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  options: ReceiptPrintOptions = {}
) {
  return saveAndOpenInvoicePdf(sale, storeProfile, options);
}

export async function printInvoiceA4(
  sale: Sale,
  storeProfile: StoreProfileWithSettings,
  options: ReceiptPrintOptions = {}
) {
  const saleData = saleToPrintSaleData(sale, storeProfile);
  await ThermalPrinterService.printA4Invoice(saleData, options);
}
