

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
  createdAt: Date | string
}

export interface SaleItem {
  productId?: string
  productName: string
  quantity: number
  unitPrice?: number
  sellingPrice: number
  discount: number
  taxRate: number
  priceIncludesGst?: boolean
  taxAmount: number
  total: number
}
