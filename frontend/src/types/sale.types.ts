

export interface Sale {
  id: string
  invoiceNumber: string
  customerId?: string
  items: SaleItem[]
  subtotal: number
  totalDiscount: number
  totalTax: number
  grandTotal: number
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit'
  amountPaid: number
  changeReturned: number
  isQuickBill: boolean
  createdAt: Date
}

export interface SaleItem {
  productId?: string
  productName: string
  quantity: number
  sellingPrice: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
}
