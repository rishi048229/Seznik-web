import type { CustomReceiptTemplate } from '@/types/customReceipt'

/** Stable id so normalization stays idempotent across reads. */
export const RESTAURANT_RECEIPT_TEMPLATE_ID = 'receipt-tpl-restaurant-bill'
export const RESTAURANT_RECEIPT_TEMPLATE_NAME = 'Restaurant Bill'

/** Compact dine-in thermal layout — ITEM | QTY | AMT columns, table & waiter meta. */
export function createRestaurantReceiptTemplate(): CustomReceiptTemplate {
  return {
    id: RESTAURANT_RECEIPT_TEMPLATE_ID,
    name: RESTAURANT_RECEIPT_TEMPLATE_NAME,
    description: 'Restaurant dine-in bill with table, waiter, and compact item columns',
    paperWidth: '58mm',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entries: [
      {
        id: 'entry-logo-restaurant',
        type: 'image',
        enabled: true,
        align: 'center',
        widthPercent: 60,
      },
      {
        id: 'entry-store-name-restaurant',
        type: 'text',
        enabled: true,
        text: '{{store_name}}',
        size: 'large',
        bold: true,
        align: 'center',
      },
      {
        id: 'entry-store-details-restaurant',
        type: 'text',
        enabled: true,
        text: '{{store_address}}\nPh: {{store_phone}}\nGSTIN: {{store_gstin}}',
        size: 'small',
        align: 'center',
      },
      {
        id: 'entry-cash-bill-restaurant',
        type: 'text',
        enabled: true,
        text: 'CASH/BILL',
        size: 'medium',
        bold: true,
        align: 'center',
      },
      {
        id: 'entry-divider-restaurant-1',
        type: 'horizontal_line',
        enabled: true,
        lineStyle: 'dashed',
      },
      {
        id: 'entry-bill-row-restaurant',
        type: 'left_right_text',
        enabled: true,
        left: 'Bill: {{invoice_no}}',
        right: '{{date}}',
        size: 'small',
      },
      {
        id: 'entry-table-row-restaurant',
        type: 'left_right_text',
        enabled: true,
        left: 'TNo {{table_no}} {{waiter_name}}',
        right: '{{time}}',
        size: 'small',
      },
      {
        id: 'entry-divider-restaurant-2',
        type: 'horizontal_line',
        enabled: true,
        lineStyle: 'dashed',
      },
      {
        id: 'entry-items-restaurant',
        type: 'table',
        enabled: true,
        tableType: 'advanced',
        showItemNumbers: false,
        columnHeaders: {
          item: 'ITEM',
          qty: 'QTY',
          total: 'AMT',
        },
      },
      {
        id: 'entry-divider-restaurant-3',
        type: 'horizontal_line',
        enabled: true,
        lineStyle: 'dashed',
      },
      {
        id: 'entry-subtotal-restaurant',
        type: 'left_right_text',
        enabled: true,
        left: 'Sub Total',
        right: '{{subtotal}}',
        size: 'small',
      },
      {
        id: 'entry-tax-restaurant',
        type: 'left_right_text',
        enabled: true,
        left: 'Tax',
        right: '{{tax}}',
        size: 'small',
      },
      {
        id: 'entry-divider-restaurant-4',
        type: 'horizontal_line',
        enabled: true,
        lineStyle: 'dashed',
      },
      {
        id: 'entry-grand-restaurant',
        type: 'left_right_text',
        enabled: true,
        left: 'Net Amount',
        right: '{{grand_total}}',
        size: 'medium',
        bold: true,
      },
      {
        id: 'entry-divider-restaurant-5',
        type: 'horizontal_line',
        enabled: true,
        lineStyle: 'dashed',
      },
      {
        id: 'entry-footer-restaurant',
        type: 'text',
        enabled: true,
        text: '{{footer_message}}',
        size: 'small',
        bold: true,
        align: 'center',
      },
      {
        id: 'entry-qr-restaurant',
        type: 'barcode',
        enabled: false,
        codeType: 'qr_code',
        format: 'qr',
        value: '{{bill_pdf_url}}',
        align: 'center',
        size: 'medium',
        qrType: 'digital_bill',
      },
    ],
  }
}

export function isRestaurantReceiptTemplate(template?: Pick<CustomReceiptTemplate, 'id' | 'name'> | null): boolean {
  if (!template) return false
  return template.id === RESTAURANT_RECEIPT_TEMPLATE_ID || template.name === RESTAURANT_RECEIPT_TEMPLATE_NAME
}
