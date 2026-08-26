export interface Location {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ProductLocationStock {
  id: string
  productId: string
  locationId: string
  stock: number
  /** null = use the product's own sellingPrice. */
  priceOverride: number | null
  /** null = use the product's own lowStockThreshold. */
  lowStockThreshold: number | null
  createdAt: string
  updatedAt: string
  product?: {
    id: string
    name: string
    sku: string
    barcode: string | null
    sellingPrice: number
    currentStock: number
  }
  location?: { id: string; name: string; isActive: boolean }
}

export interface StockTransfer {
  id: string
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  note: string | null
  createdAt: string
  product?: { id: string; name: string; sku: string }
  fromLocation?: { id: string; name: string }
  toLocation?: { id: string; name: string }
}
