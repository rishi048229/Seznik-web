

export interface Purchase {
  id: string
  invoiceNumber: string
  supplierId: string
  items: PurchaseItem[]
  subtotal: number
  totalTax: number
  grandTotal: number
  paymentMethod: 'cash' | 'bank' | 'upi' | 'credit'
  amountPaid: number
  createdAt: Date | string
}

export interface PurchaseItem {
  productId?: string
  productName: string
  quantity: number
  costPrice: number
  total: number
}
