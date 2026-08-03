

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  /** Barcode symbology used for label printing (CODE128 default). */
  barcodeType?: 'CODE128' | 'EAN13' | 'QR'
  categoryId: string
  supplierId?: string
  imageURL?: string
  costPrice: number
  sellingPrice: number
  taxRate: number
  priceIncludesGst?: boolean
  currentStock: number
  lowStockThreshold: number
  unit: 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface StockHistory {
  id: string
  change: number
  reason: string
  barcode?: string
  createdAt: Date
}

export interface CartItem {
  productId: string
  productName: string
  imageURL?: string
  quantity: number
  sellingPrice: number
  taxRate: number
  discount: number
}
