import { fetchApi } from './api'
import type { Product, StockHistory } from '@/types/product.types'
import type { BarcodeStockEntry } from '@/types/barcode.types'

export const getProducts = async (uid: string): Promise<Product[]> => {
  return await fetchApi('/products')
}

export const createProduct = async (
  uid: string,
  data: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const sku = await generateSKU(uid, data.categoryId)
  const product = await fetchApi('/products', {
    method: 'POST',
    body: JSON.stringify({ ...data, sku }),
  })
  return product.id
}

export const updateProduct = async (
  uid: string,
  productId: string,
  data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  await fetchApi(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const softDeleteProduct = async (uid: string, productId: string): Promise<void> => {
  await fetchApi(`/products/${productId}`, {
    method: 'DELETE',
  })
}

export const bulkSoftDeleteProducts = async (uid: string, productIds: string[]): Promise<void> => {
  await fetchApi('/products/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
  })
}

export const adjustStock = async (
  uid: string,
  productId: string,
  qty: number,
  reason: string
): Promise<void> => {
  await fetchApi(`/products/${productId}/stock`, {
    method: 'POST',
    body: JSON.stringify({ qty, reason }),
  })
}

export const getProductByBarcode = async (uid: string, barcode: string): Promise<Product | null> => {
  try {
    return await fetchApi(`/products/barcode/${barcode}`)
  } catch {
    return null
  }
}

export const batchBarcodeStockUpdate = async (
  uid: string,
  entries: BarcodeStockEntry[]
): Promise<void> => {
  await fetchApi('/products/batch-stock-update', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  })
}

export const getLowStockProducts = async (uid: string, threshold: number): Promise<Product[]> => {
  return await fetchApi(`/products/low-stock?threshold=${threshold}`)
}

// Internal SKU generation is now handled on frontend or backend.
// We should preferably generate it on frontend before create, or let backend do it.
// The previous firebase logic generated it before adding the document.
let _skuCounter = 0

const generateSKU = async (uid: string, categoryId: string): Promise<string> => {
  // In a real DB we would fetch the count of products in this category.
  // For simplicity, we just use a counter or random here.
  _skuCounter++
  const prefix = categoryId.substring(0, 3).toUpperCase()
  return `${prefix}-${String(_skuCounter).padStart(4, '0')}`
}

export { generateSKU as formatSKU }
