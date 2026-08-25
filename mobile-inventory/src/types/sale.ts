export interface SaleItem {
  productId?: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  taxAmount?: number;
  priceIncludesGst?: boolean;
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  discountAmount?: number;
  discountApplied?: boolean;
  total: number;
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank' | 'credit';

export interface AppliedBillCharge {
  presetId: string;
  label: string;
  kind: 'service' | 'legacy_vat' | 'other';
  type: 'percent' | 'flat';
  value: number;
  amount: number;
  applyOn?: 'net_subtotal' | 'gross';
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  items: SaleItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  billCharges?: AppliedBillCharge[] | null;
  extraChargesTotal?: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  isQuickBill: boolean;
  notes?: string | null;
  platform?: 'mobile' | 'web' | string;
  createdAt: string;
}

export interface CreateSalePayload {
  customerId?: string;
  items: SaleItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  billCharges?: AppliedBillCharge[];
  extraChargesTotal?: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  isQuickBill?: boolean;
  notes?: string;
  platform?: 'mobile' | 'web' | string;
}
