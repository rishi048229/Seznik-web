import type { Product } from '@/types/product.types'
import type { Purchase } from '@/types/purchase.types'
import type { Sale, SaleItem } from '@/types/sale.types'

export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export type GstLine = {
  key: string
  productId?: string
  productName: string
  rate: number
  quantity: number
  taxable: number
  tax: number
}

export type GstRateBucket = {
  rate: number
  taxable: number
  tax: number
  quantity: number
  products: GstLine[]
}

export type GstLedger = {
  collected: number
  paid: number
  net: number
  taxableSales: number
  taxablePurchases: number
  rates: GstRateBucket[]
  products: GstLine[]
}

type SaleItemLike = Pick<SaleItem, 'productName' | 'quantity' | 'sellingPrice' | 'discount' | 'taxRate'> & {
  productId?: string
  priceIncludesGst?: boolean
}

/** Recompute line GST. Do not trust stored taxAmount — inclusive lines were sometimes saved with the exclusive formula. */
export function computeSaleLineGst(item: SaleItemLike) {
  const qty = Number(item.quantity) || 0
  const price = Number(item.sellingPrice) || 0
  const discount = Number(item.discount) || 0
  const line = price * qty - discount
  const rate = Number(item.taxRate) || 0
  if (line <= 0) return { taxable: 0, tax: 0, rate, qty }
  if (rate <= 0) return { taxable: roundMoney(line), tax: 0, rate: 0, qty }
  if (item.priceIncludesGst) {
    const taxable = line / (1 + rate / 100)
    return { taxable: roundMoney(taxable), tax: roundMoney(line - taxable), rate, qty }
  }
  return { taxable: roundMoney(line), tax: roundMoney(line * (rate / 100)), rate, qty }
}

/**
 * GST paid on a purchase line.
 * Wholesale bills are usually GST-inclusive; if the product is marked exclusive, GST is added on the recorded cost.
 */
export function computePurchaseLineGst(
  item: { productId?: string; productName: string; quantity: number; costPrice: number; total?: number },
  product?: Pick<Product, 'taxRate' | 'priceIncludesGst'> | null,
) {
  const qty = Number(item.quantity) || 0
  const line = Number(item.total ?? item.costPrice * qty) || 0
  const rate = Number(product?.taxRate) || 0
  if (line <= 0) return { taxable: 0, tax: 0, rate, qty }
  if (rate <= 0) return { taxable: roundMoney(line), tax: 0, rate: 0, qty }
  const inclusive = product?.priceIncludesGst !== false
  if (inclusive) {
    const taxable = line / (1 + rate / 100)
    return { taxable: roundMoney(taxable), tax: roundMoney(line - taxable), rate, qty }
  }
  return { taxable: roundMoney(line), tax: roundMoney(line * (rate / 100)), rate, qty }
}

const addProductLine = (map: Map<string, GstLine>, line: GstLine) => {
  const existing = map.get(line.key)
  if (!existing) {
    map.set(line.key, { ...line })
    return
  }
  existing.quantity += line.quantity
  existing.taxable = roundMoney(existing.taxable + line.taxable)
  existing.tax = roundMoney(existing.tax + line.tax)
}

export function buildGstLedger(args: {
  sales: Sale[] | undefined
  purchases: Purchase[] | undefined
  products: Product[] | undefined
  startTs: number
  endTs: number
  inRange: (ts: number) => boolean
}): GstLedger {
  const productById = new Map((args.products ?? []).map(p => [p.id, p]))
  const collectedByProduct = new Map<string, GstLine>()
  const paidByProduct = new Map<string, GstLine>()
  let collected = 0
  let paid = 0
  let taxableSales = 0
  let taxablePurchases = 0

  for (const sale of args.sales ?? []) {
    const ts = new Date(sale.createdAt).getTime()
    if (!args.inRange(ts)) continue
    for (const item of sale.items ?? []) {
      const gst = computeSaleLineGst(item)
      collected = roundMoney(collected + gst.tax)
      taxableSales = roundMoney(taxableSales + gst.taxable)
      if (gst.tax <= 0 && gst.rate <= 0) continue
      const name = item.productName || 'Item'
      const key = `${item.productId || name.toLowerCase()}@${gst.rate}`
      addProductLine(collectedByProduct, {
        key,
        productId: item.productId,
        productName: name,
        rate: gst.rate,
        quantity: gst.qty,
        taxable: gst.taxable,
        tax: gst.tax,
      })
    }
  }

  for (const purchase of args.purchases ?? []) {
    const ts = new Date(purchase.createdAt).getTime()
    if (!args.inRange(ts)) continue
    let purchaseTax = 0
    for (const item of purchase.items ?? []) {
      const product = item.productId ? productById.get(item.productId) : undefined
      const gst = computePurchaseLineGst(item, product)
      purchaseTax = roundMoney(purchaseTax + gst.tax)
      taxablePurchases = roundMoney(taxablePurchases + gst.taxable)
      if (gst.tax <= 0 && gst.rate <= 0) continue
      const name = item.productName || product?.name || 'Item'
      const key = `${item.productId || name.toLowerCase()}@${gst.rate}`
      addProductLine(paidByProduct, {
        key,
        productId: item.productId,
        productName: name,
        rate: gst.rate,
        quantity: gst.qty,
        taxable: gst.taxable,
        tax: gst.tax,
      })
    }
    if (purchaseTax === 0 && purchase.totalTax > 0) {
      paid = roundMoney(paid + purchase.totalTax)
    } else {
      paid = roundMoney(paid + purchaseTax)
    }
  }

  const rateMap = new Map<number, GstRateBucket>()
  const ensureRate = (rate: number) => {
    const existing = rateMap.get(rate)
    if (existing) return existing
    const created: GstRateBucket = { rate, taxable: 0, tax: 0, quantity: 0, products: [] }
    rateMap.set(rate, created)
    return created
  }

  for (const line of collectedByProduct.values()) {
    const bucket = ensureRate(line.rate)
    bucket.taxable = roundMoney(bucket.taxable + line.taxable)
    bucket.tax = roundMoney(bucket.tax + line.tax)
    bucket.quantity += line.quantity
    bucket.products.push(line)
  }

  const rates = [...rateMap.values()]
    .sort((a, b) => a.rate - b.rate)
    .map(bucket => ({
      ...bucket,
      products: bucket.products.sort((a, b) => b.tax - a.tax),
    }))

  return {
    collected,
    paid,
    net: roundMoney(collected - paid),
    taxableSales,
    taxablePurchases,
    rates,
    products: [...collectedByProduct.values()].sort((a, b) => b.tax - a.tax || a.productName.localeCompare(b.productName)),
  }
}

export function formatGstRate(rate: number) {
  return `${Number.isInteger(rate) ? rate : rate.toFixed(2)}%`
}
