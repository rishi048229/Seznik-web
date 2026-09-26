import prisma from '../config/db';

/** Calendar day window in UTC — same boundary for all stores (simple, predictable). */
function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export const DAILY_SALE_CREATE_LIMIT = 200;
export const DAILY_PRODUCT_CREATE_LIMIT = 500;
export const BULK_PRODUCT_IMPORT_MAX = 500;
export const MAX_ACTIVE_PRODUCTS = 5000;

export async function countSalesCreatedToday(userId: string): Promise<number> {
  const since = startOfUtcDay();
  return prisma.sale.count({
    where: { userId, createdAt: { gte: since } },
  });
}

export async function assertCanCreateSale(userId: string): Promise<void> {
  const count = await countSalesCreatedToday(userId);
  if (count >= DAILY_SALE_CREATE_LIMIT) {
    const err = new Error(
      `Daily invoice limit reached (${DAILY_SALE_CREATE_LIMIT} per day). Try again tomorrow or contact support.`
    );
    (err as any).statusCode = 429;
    throw err;
  }
}

export async function countProductsCreatedToday(userId: string): Promise<number> {
  const since = startOfUtcDay();
  return prisma.product.count({
    where: { userId, createdAt: { gte: since } },
  });
}

export async function countActiveProducts(userId: string): Promise<number> {
  return prisma.product.count({
    where: { userId, isActive: true },
  });
}

export async function assertCanCreateProducts(userId: string, additionalCount = 1): Promise<void> {
  const active = await countActiveProducts(userId);
  if (active + additionalCount > MAX_ACTIVE_PRODUCTS) {
    const err = new Error(
      `Product catalog limit reached (${MAX_ACTIVE_PRODUCTS} active products). Archive or delete items before adding more.`
    );
    (err as any).statusCode = 400;
    throw err;
  }

  const today = await countProductsCreatedToday(userId);
  if (today + additionalCount > DAILY_PRODUCT_CREATE_LIMIT) {
    const remaining = Math.max(0, DAILY_PRODUCT_CREATE_LIMIT - today);
    const err = new Error(
      `Daily product limit reached (${DAILY_PRODUCT_CREATE_LIMIT} per day). You can add ${remaining} more today.`
    );
    (err as any).statusCode = 429;
    throw err;
  }
}
