import type { SaleItem } from '@/types/sale.types'

type SaleItemLike = Partial<SaleItem> & {
  unitPrice?: number
  price?: number
  discountAmount?: number
}

/** Unit price for POS (`sellingPrice`) and KOT (`unitPrice`) sale line items. */
export function getSaleItemUnitPrice(item: SaleItemLike): number {
  return Number(item.sellingPrice ?? item.unitPrice ?? item.price ?? 0)
}

export function getSaleItemDiscount(item: SaleItemLike): number {
  return Number(item.discount ?? item.discountAmount ?? 0)
}

export function getSaleItemLineTotal(item: SaleItemLike): number {
  const storedTotal = Number(item.total)
  if (Number.isFinite(storedTotal) && storedTotal > 0) {
    return storedTotal
  }
  const qty = Number(item.quantity ?? 1)
  return getSaleItemUnitPrice(item) * qty - getSaleItemDiscount(item)
}
