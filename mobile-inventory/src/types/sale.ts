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
export type OrderType = 'walk_in' | 'delivery';
export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'partial';

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
  returnStatus?: 'none' | 'partial' | 'full';
  totalRefunded?: number;

  /** True once this sale's receipt has been fulfilled at least once via Remote Print. */
  isRemotePrint?: boolean;
  lastRemotePrintJobId?: string | null;

  // Delivery & Fulfillment fields
  orderType?: OrderType;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  deliveryNotes?: string | null;
  scheduledDeliveryDate?: Date | string | null;
  deliveryStatus?: DeliveryStatus;
  deliveredAt?: Date | string | null;
  paymentStatus?: PaymentStatus;
  paymentDueDate?: Date | string | null;

  createdAt: string;
}

export interface ReturnedItemLine {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxableAmount: number;
  gstAmount: number;
  refundAmount: number;
  restock: boolean;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  customerId?: string | null;
  items: ReturnedItemLine[];
  subtotal: number;
  totalTax: number;
  extraChargesRefunded: number;
  refundAmount: number;
  refundMethod: 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal';
  reason?: string | null;
  notes?: string | null;
  platform?: string;
  createdAt: string;
}

export interface CreateSaleReturnPayload {
  items: {
    productId?: string;
    productName?: string;
    quantity: number;
    restock?: boolean;
  }[];
  refundMethod: 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal';
  reason?: string;
  notes?: string;
  extraChargesRefunded?: number;
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

export interface SaleExchange {
  id: string;
  exchangeNumber: string;
  originalSaleId: string;
  saleReturnId: string;
  saleReturn?: SaleReturn;
  newSaleId: string;
  newSale?: Sale;
  differenceAmount: number;
  exchangeDiscount?: number;
  settlementMethod: string;
  reason?: string | null;
  notes?: string | null;
  platform?: string;
  createdAt: string;
}

export interface CreateSaleExchangePayload {
  originalSaleId?: string;
  returnedItems: {
    productId?: string;
    productName?: string;
    quantity: number;
    restock?: boolean;
  }[];
  newItems: {
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    sellingPrice?: number;
    taxRate: number;
    priceIncludesGst?: boolean;
    total?: number;
  }[];
  newSubtotal: number;
  newTotalDiscount?: number;
  newTotalTax: number;
  newGrandTotal: number;
  differenceAmount?: number;
  exchangeDiscount?: number;
  settlementMethod?: string;
  reason?: string;
  notes?: string;
}


