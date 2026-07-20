

export interface Purchase {
  id: string
  supplierId: string
  items: PurchaseItem[]
  totalAmount: number
  purchaseDate: Date | Date
  createdAt: Date
}

export interface PurchaseItem {
  productId?: string
  productName: string
  quantity: number
  costPrice: number
  total: number
}
