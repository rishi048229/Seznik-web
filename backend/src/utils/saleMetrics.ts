/** Cost of goods for a sale line — prefers snapshot costPrice on the item, then catalog cost. */
export function computeSaleItemCost(item: any, productCosts: Map<string, number>): number {
  if (!item?.productId) return 0;
  const unitCost = item.costPrice ?? productCosts.get(item.productId) ?? 0;
  return unitCost * (item.quantity || 0);
}

export function computeSaleCost(sale: { items: unknown }, productCosts: Map<string, number>): number {
  const items = sale.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + computeSaleItemCost(item, productCosts), 0);
}

export function computeSaleGrossProfit(
  sale: { grandTotal: number; totalTax: number; items: unknown },
  productCosts: Map<string, number>
): number {
  return sale.grandTotal - sale.totalTax - computeSaleCost(sale, productCosts);
}
