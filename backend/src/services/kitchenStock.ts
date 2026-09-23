import prisma from '../config/db';

/** Deduct recipe ingredients when a KOT is billed. Missing recipes are a no-op. */
export async function deductKitchenStockForOrder(
  userId: string,
  items: Array<{ productId?: string | null; quantity: number }>
): Promise<void> {
  const productIds = items.map((it) => it.productId).filter(Boolean) as string[];
  if (productIds.length === 0) return;

  const lines = await prisma.recipeLine.findMany({
    where: { userId, productId: { in: productIds } },
  });
  if (lines.length === 0) return;

  const qtyByProduct = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) || 0) + (Number(it.quantity) || 0));
  }

  for (const line of lines) {
    const sold = qtyByProduct.get(line.productId) || 0;
    if (sold <= 0) continue;
    await prisma.kitchenIngredient.update({
      where: { id: line.ingredientId },
      data: { currentStock: { decrement: line.quantity * sold } },
    }).catch(() => {});
  }
}
