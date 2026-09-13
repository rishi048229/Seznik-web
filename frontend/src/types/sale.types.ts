

export type OrderType = 'walk_in' | 'delivery';
export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'partial';

export interface AppliedBillCharge {
  presetId: string
  label: string
  kind: 'service' | 'legacy_vat' | 'other'
  type: 'percent' | 'flat'
  value: number
  amount: number
  applyOn?: 'net_subtotal' | 'gross'
}

export interface Sale {
  id: string
  invoiceNumber: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  items: SaleItem[]
  subtotal: number
  totalDiscount: number
  totalTax: number
  grandTotal: number
  finalTotal?: number
  billCharges?: AppliedBillCharge[] | null
  appliedCharges?: AppliedBillCharge[] | null
  extraChargesTotal?: number
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit'
  amountPaid: number
  changeReturned: number
  isQuickBill: boolean
  platform?: 'web' | 'mobile' | string
  returnStatus?: 'none' | 'partial' | 'full'
  totalRefunded?: number
  returns?: SaleReturn[]
  
  // Delivery & Fulfillment fields
  orderType?: OrderType
  deliveryAddress?: string | null
  deliveryPhone?: string | null
  deliveryNotes?: string | null
  scheduledDeliveryDate?: Date | string | null
  deliveryStatus?: DeliveryStatus
  deliveredAt?: Date | string | null
  paymentStatus?: PaymentStatus
  paymentDueDate?: Date | string | null

  createdAt: Date | string
}

export interface SaleItem {
  productId?: string
  id?: string
  productName: string
  name?: string
  quantity: number
  unitPrice?: number
  sellingPrice: number
  discount: number
  taxRate: number
  priceIncludesGst?: boolean
  taxAmount: number
  total: number
}

export interface ReturnedItemLine {
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  taxRate: number
  taxableAmount: number
  gstAmount: number
  refundAmount: number
  restock: boolean
}

export interface SaleReturn {
  id: string
  returnNumber: string
  saleId: string
  sale?: Sale
  customerId?: string | null
  customer?: { id: string; name: string; phone?: string } | null
  items: ReturnedItemLine[]
  subtotal: number
  totalTax: number
  extraChargesRefunded: number
  refundAmount: number
  refundMethod: 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal'
  reason?: string | null
  notes?: string | null
  locationId?: string | null
  platform?: string
  userId: string
  createdAt: Date | string
}

export interface CreateSaleReturnPayload {
  items: {
    productId?: string
    id?: string
    productName?: string
    quantity: number
    restock?: boolean
  }[]
  refundMethod: 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_reversal'
  reason?: string
  notes?: string
  extraChargesRefunded?: number
}

export interface SaleExchange {
  id: string
  exchangeNumber: string
  originalSaleId: string
  originalSale?: Sale
  saleReturnId: string
  saleReturn?: SaleReturn
  newSaleId: string
  newSale?: Sale
  differenceAmount: number
  exchangeDiscount?: number
  settlementMethod: 'even_exchange' | 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_ledger' | string
  reason?: string | null
  notes?: string | null
  platform?: string
  userId: string
  createdAt: Date | string
}

export interface CreateSaleExchangePayload {
  originalSaleId?: string
  returnedItems: {
    productId?: string
    id?: string
    productName?: string
    quantity: number
    restock?: boolean
  }[]
  extraChargesRefunded?: number
  newItems: {
    productId?: string
    id?: string
    name: string
    quantity: number
    unitPrice: number
    sellingPrice?: number
    discount?: number
    taxRate: number
    priceIncludesGst?: boolean
    taxAmount?: number
    total?: number
  }[]
  newSubtotal: number
  newTotalDiscount?: number
  newTotalTax: number
  newGrandTotal: number
  newBillCharges?: AppliedBillCharge[] | null
  newExtraChargesTotal?: number
  differenceAmount?: number
  exchangeDiscount?: number
  settlementMethod?: 'even_exchange' | 'cash' | 'upi' | 'card' | 'store_credit' | 'credit_ledger' | string
  amountPaid?: number
  changeReturned?: number
  reason?: string
  notes?: string
}


