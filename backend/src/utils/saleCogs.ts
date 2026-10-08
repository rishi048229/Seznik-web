/**
 * Cost of goods sold for completed sales. Uses per-line costPrice when the sale
 * was recorded (snapshot), otherwise catalog cost at report time. Discounts reduce
 * revenue (grandTotal) but never reduce COGS.
 */

export type SaleLineLike = {
  productId?: string | null
  productName?: string | null
  quantity?: number | null
  costPrice?: number | null
}

export function lineItemCogs(
  item: SaleLineLike,
  productCosts: Map<string, number>,
  productCostsByName?: Map<string, number>
): number {
  const qty = Math.max(0, Number(item.quantity) || 0)
  if (qty <= 0) return 0

  const snap = Number(item.costPrice)
  if (Number.isFinite(snap) && snap >= 0) {
    return snap * qty
  }

  if (item.productId) {
    const unit = productCosts.get(String(item.productId))
    if (unit != null && unit >= 0) return unit * qty
  }

  const name = String(item.productName || '').trim().toLowerCase()
  if (name && productCostsByName?.has(name)) {
    return (productCostsByName.get(name) ?? 0) * qty
  }

  return 0
}

export function saleCogs(
  items: unknown,
  productCosts: Map<string, number>,
  productCostsByName?: Map<string, number>
): number {
  if (!Array.isArray(items)) return 0
  return items.reduce(
    (sum, it) => sum + lineItemCogs(it as SaleLineLike, productCosts, productCostsByName),
    0
  )
}

export function buildProductCostMaps(
  products: Array<{ id: string; name: string; costPrice: number }>
): { byId: Map<string, number>; byName: Map<string, number> } {
  const byId = new Map<string, number>()
  const byName = new Map<string, number>()
  for (const p of products) {
    byId.set(p.id, Number(p.costPrice) || 0)
    const key = p.name.trim().toLowerCase()
    if (key) byName.set(key, Number(p.costPrice) || 0)
  }
  return { byId, byName }
}
