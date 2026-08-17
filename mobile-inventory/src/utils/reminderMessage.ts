import type { Settings } from '@/api/settings';
import type { CustomerBill } from '@/api/credits';

const DIVIDER = '--------------------------------';

/**
 * A proper bill-style WhatsApp reminder for one specific outstanding bill — business name,
 * invoice number, itemised lines and the amount due, so the customer sees an actual receipt,
 * not just a generic "you owe money" text.
 */
export function buildBillReminderMessage(
  settings: Settings | null | undefined,
  customerName: string,
  bill: Pick<CustomerBill, 'invoiceNumber' | 'items' | 'outstandingAmount' | 'date'>,
  daysOverdue?: number
): string {
  const businessName = settings?.businessName || 'Our Store';
  const lines: string[] = [`*${businessName}*`];
  if (settings?.businessAddress) lines.push(settings.businessAddress);
  if (settings?.businessPhone) lines.push(`📞 ${settings.businessPhone}`);
  if (settings?.businessGSTIN) lines.push(`GSTIN: ${settings.businessGSTIN}`);
  lines.push(DIVIDER);
  if (bill.invoiceNumber) lines.push(`Invoice: ${bill.invoiceNumber}`);
  lines.push(`Date: ${new Date(bill.date).toLocaleDateString('en-IN')}`);

  if (bill.items && bill.items.length > 0) {
    lines.push(DIVIDER);
    bill.items.forEach((item) => {
      const amount = item.total ?? (item.unitPrice ?? 0) * item.quantity;
      lines.push(`${item.productName} x${item.quantity} — ₹${amount.toFixed(2)}`);
    });
  }

  lines.push(DIVIDER);
  lines.push(`*Amount Due: ₹${bill.outstandingAmount.toFixed(2)}*`);
  lines.push(DIVIDER);

  const overdueText = daysOverdue && daysOverdue > 0 ? ` This has been pending for ${daysOverdue} day(s).` : '';
  lines.push(`Dear ${customerName}, this is a reminder for the above bill.${overdueText} Please settle at your earliest convenience.`);
  lines.push('Thank you for shopping with us! 🙏');

  return lines.join('\n');
}

/** Fallback for a lump-sum reminder when there's no single bill to point to (e.g. manual credit). */
export function buildBalanceReminderMessage(
  settings: Settings | null | undefined,
  customerName: string,
  totalOutstanding: number,
  daysOverdue?: number
): string {
  const businessName = settings?.businessName || 'Our Store';
  const overdueText = daysOverdue && daysOverdue > 0 ? ` pending for ${daysOverdue} day(s)` : '';
  return (
    `*${businessName} — Payment Reminder*\n` +
    `Dear ${customerName},\n` +
    `Your total outstanding balance is ₹${totalOutstanding.toFixed(2)}${overdueText}.\n` +
    `Please settle at your earliest convenience.\nThank you!`
  );
}
