import type { Product } from './product.types'

export type BarcodeScanMode = 'stock-update' | 'pos'

export interface BarcodeScanResult {
  barcode: string
  product: Product | null
  timestamp: number
}

export interface BarcodeStockEntry {
  productId: string
  productName: string
  barcode: string
  currentStock: number
  qtyToAdd: number
  unit: string
}
