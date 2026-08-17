export interface SaleItem {
  productId?: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank' | 'credit';

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
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  isQuickBill: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface CreateSalePayload {
  customerId?: string;
  items: SaleItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeReturned: number;
  isQuickBill?: boolean;
  notes?: string;
}
