import type { CustomReceiptEntry, LeftRightTextReceiptEntry } from '@/types/customReceipt';

export function isDiscountReceiptEntry(entry: CustomReceiptEntry): boolean {
  if (entry.type !== 'left_right_text') return false;
  return (
    entry.left?.toLowerCase().includes('discount') ||
    entry.right?.toLowerCase().includes('discount') ||
    entry.left?.includes('{{discount}}') ||
    entry.right?.includes('{{discount}}')
  );
}

export function isTaxReceiptEntry(entry: CustomReceiptEntry): boolean {
  if (entry.type !== 'left_right_text') return false;
  const left = entry.left?.toLowerCase() || '';
  const right = entry.right?.toLowerCase() || '';
  return (
    left.includes('tax') ||
    left.includes('gst') ||
    right.includes('{{tax}}') ||
    right.includes('{{total_tax}}')
  );
}

export function templateHasDiscountEntry(entries: CustomReceiptEntry[]): boolean {
  return entries.some((entry) => entry.enabled && isDiscountReceiptEntry(entry));
}

/** Insert a discount row after subtotal when the template lacks one but a discount was applied. */
export function enrichCustomReceiptEntries(
  entries: CustomReceiptEntry[],
  totalDiscount: number
): CustomReceiptEntry[] {
  if (!totalDiscount || totalDiscount <= 0) return entries;
  if (templateHasDiscountEntry(entries)) return entries;

  const discountEntry: LeftRightTextReceiptEntry = {
    id: `auto-discount-${Date.now()}`,
    type: 'left_right_text',
    enabled: true,
    left: 'Discount',
    right: '-{{discount}}',
    size: 'small',
    bold: true,
  };

  const subIdx = entries.findIndex(
    (entry) =>
      entry.enabled &&
      entry.type === 'left_right_text' &&
      (entry.left?.toLowerCase().includes('sub') ||
        entry.right?.includes('{{subtotal}}'))
  );

  const next = [...entries];
  next.splice(subIdx >= 0 ? subIdx + 1 : next.length, 0, discountEntry);
  return next;
}

export function formatReceiptDiscountAmount(amount: number): string {
  return `-₹${amount.toFixed(2)}`;
}

export function shouldShowItemDiscount(discount?: number): boolean {
  return typeof discount === 'number' && discount > 0;
}
