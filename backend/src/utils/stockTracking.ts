import prisma from '../config/db'

/** Restaurants/cafes prepare on demand — inventory quantity is not decremented. */
export function trackStockForBusinessType(businessType: string | null | undefined): boolean {
  return businessType !== 'restaurant_cafe'
}

/**
 * Source of truth: Settings.trackStock when present; otherwise derive from User.businessType.
 * Used by sales, KOT settle, purchases, and stock adjust endpoints.
 */
export async function userTracksStock(userId: string): Promise<boolean> {
  const [settings, user] = await Promise.all([
    (prisma.settings as any).findUnique({
      where: { userId },
      select: { trackStock: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { businessType: true },
    }),
  ])

  if (typeof settings?.trackStock === 'boolean') {
    return settings.trackStock
  }
  return trackStockForBusinessType(user?.businessType)
}

export async function syncTrackStockForUser(
  userId: string,
  businessType: string | null | undefined
): Promise<void> {
  const trackStock = trackStockForBusinessType(businessType)
  await (prisma.settings as any).upsert({
    where: { userId },
    update: { trackStock },
    create: { userId, trackStock },
  })

  if (!trackStock) {
    // Non-gating stock so quantity checks never block restaurant menus.
    await prisma.product.updateMany({
      where: { userId, currentStock: { lt: 999999 } },
      data: { currentStock: 999999, lowStockThreshold: 0 },
    })
  }
}
