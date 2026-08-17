import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Settings } from '@/api/settings';
import type { CustomerBill } from '@/api/credits';

/**
 * Builds a printable HTML bill/receipt for one outstanding credit bill — styled like the
 * existing thermal receipt HTML (PrinterService.generateReceiptHtml) so it looks like a real
 * shop bill, not a plain message. Used to generate an actual attachable document for reminders,
 * since a wa.me deep link can only pre-fill text, never attach a file.
 */
export function buildBillReceiptHtml(
  settings: Settings | null | undefined,
  customerName: string,
  bill: Pick<CustomerBill, 'invoiceNumber' | 'items' | 'originalAmount' | 'outstandingAmount' | 'date'>,
  daysOverdue?: number
): string {
  const businessName = (settings?.businessName || 'Your Store').toUpperCase();
  const itemsHtml =
    bill.items && bill.items.length > 0
      ? bill.items
          .map((item, idx) => {
            const amount = item.total ?? (item.unitPrice ?? 0) * item.quantity;
            return `
            <div style="margin-bottom: 6px;">
              <div><b>${idx + 1}. ${item.productName}</b></div>
              <div style="display: flex; justify-content: space-between;">
                <span>&nbsp;&nbsp;${item.quantity} x ${(item.unitPrice ?? 0).toFixed(2)}</span>
                <span>${amount.toFixed(2)}</span>
              </div>
            </div>`;
          })
          .join('')
      : '<div>Credit Entry</div>';

  const paidAmount = Math.max(0, bill.originalAmount - bill.outstandingAmount);
  const overdueLine =
    daysOverdue && daysOverdue > 0
      ? `<div class="center" style="margin-top: 8px; color: #B91C1C;">Pending for ${daysOverdue} day(s)</div>`
      : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0; size: auto; }
          body {
            width: 320px;
            margin: 0 auto;
            padding: 14px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-bottom: 2px double #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 17px;">${businessName}</div>
        ${settings?.businessAddress ? `<div class="center">${settings.businessAddress}</div>` : ''}
        ${settings?.businessPhone ? `<div class="center">Phone: ${settings.businessPhone}</div>` : ''}
        ${settings?.businessGSTIN ? `<div class="center">GSTIN: ${settings.businessGSTIN}</div>` : ''}
        <div class="divider"></div>
        ${bill.invoiceNumber ? `<div>Invoice: <b>${bill.invoiceNumber}</b></div>` : ''}
        <div>Date: ${new Date(bill.date).toLocaleDateString('en-IN')}</div>
        <div>Customer: ${customerName}</div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <table>
          <tr><td>Bill Amount</td><td class="right">Rs.${bill.originalAmount.toFixed(2)}</td></tr>
          ${paidAmount > 0 ? `<tr><td>Paid</td><td class="right">-Rs.${paidAmount.toFixed(2)}</td></tr>` : ''}
        </table>
        <div class="double-divider"></div>
        <table class="bold">
          <tr><td>Amount Due</td><td class="right">Rs.${bill.outstandingAmount.toFixed(2)}</td></tr>
        </table>
        ${overdueLine}
        <div class="center" style="margin-top: 14px;">Please settle at your earliest convenience.</div>
        <div class="center bold" style="margin-top: 4px;">Thank you!</div>
      </body>
    </html>
  `;
}

/**
 * Renders the bill as a PDF and opens the native OS share sheet (WhatsApp, etc. can attach it)
 * — the only way to actually send a document/image alongside a reminder, since wa.me links are
 * text-only. Requires no new native dependency: expo-print + expo-sharing are already installed
 * and used elsewhere in this app.
 */
export async function shareBillReceiptPdf(
  settings: Settings | null | undefined,
  customerName: string,
  bill: Pick<CustomerBill, 'invoiceNumber' | 'items' | 'originalAmount' | 'outstandingAmount' | 'date'>,
  daysOverdue?: number
): Promise<void> {
  const html = buildBillReceiptHtml(settings, customerName, bill, daysOverdue);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bill for ${customerName}`,
    });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}
