import { fetchApi } from './api'
import type { Product } from '@/types/product.types'
import type { BarcodeStockEntry } from '@/types/barcode.types'

export const getProducts = async (_uid: string): Promise<Product[]> => {
  return await fetchApi('/products')
}

export const createProduct = async (
  _uid: string,
  data: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const sku = await generateSKU(_uid, data.categoryId)
  const product = await fetchApi('/products', {
    method: 'POST',
    body: JSON.stringify({ ...data, sku }),
  })
  return product.id
}

export const updateProduct = async (
  _uid: string,
  productId: string,
  data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  await fetchApi(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const softDeleteProduct = async (_uid: string, productId: string): Promise<void> => {
  await fetchApi(`/products/${productId}`, {
    method: 'DELETE',
  })
}

export const bulkSoftDeleteProducts = async (_uid: string, productIds: string[]): Promise<void> => {
  await fetchApi('/products/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
  })
}

export const adjustStock = async (
  _uid: string,
  productId: string,
  qty: number,
  reason: string
): Promise<void> => {
  await fetchApi(`/products/${productId}/stock`, {
    method: 'POST',
    body: JSON.stringify({ qty, reason }),
  })
}

export const getProductByBarcode = async (_uid: string, barcode: string): Promise<Product | null> => {
  try {
    return await fetchApi(`/products/barcode/${barcode}`)
  } catch {
    return null
  }
}

export const batchBarcodeStockUpdate = async (
  _uid: string,
  entries: BarcodeStockEntry[]
): Promise<void> => {
  await fetchApi('/products/batch-stock-update', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  })
}

export const getLowStockProducts = async (_uid: string, threshold: number): Promise<Product[]> => {
  return await fetchApi(`/products/low-stock?threshold=${threshold}`)
}

// Internal SKU generation is now handled on frontend or backend.
// We should preferably generate it on frontend before create, or let backend do it.
// The previous firebase logic generated it before adding the document.
export interface AiExtractedProduct {
  id: string
  name: string
  sellingPrice: number
  costPrice: number
  categoryName: string
  barcode: string
  isExistingBarcode: boolean
  barcodeType: string
  taxRate: number
  currentStock: number
  lowStockThreshold: number
  unit: string
  priceIncludesGst: boolean
  selected: boolean
}

export const extractProductsFromAiDocument = async (
  _uid: string,
  documentData: string,
  mimeType: string = 'image/jpeg',
  customApiKey?: string
): Promise<{ count: number; products: AiExtractedProduct[] }> => {
  return await fetchApi('/products/ai-extract-document', {
    method: 'POST',
    body: JSON.stringify({ documentData, mimeType, customApiKey }),
  })
}

export const bulkImportProducts = async (
  _uid: string,
  products: Partial<AiExtractedProduct>[]
): Promise<{ count: number }> => {
  return await fetchApi('/products/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ products }),
  })
}

let _skuCounter = 0

const generateSKU = async (_uid: string, categoryId: string): Promise<string> => {
  _skuCounter++
  const prefix = categoryId.substring(0, 3).toUpperCase()
  return `${prefix}-${String(_skuCounter).padStart(4, '0')}`
}

export { generateSKU as formatSKU }

