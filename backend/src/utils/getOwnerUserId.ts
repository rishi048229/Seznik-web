import prisma from '../config/db';

async function canonicalOwnerId(idOrUid: string): Promise<string | null> {
  const byId = await prisma.user.findUnique({ where: { id: idOrUid }, select: { id: true } });
  if (byId) return byId.id;
  const byUid = await prisma.user.findUnique({ where: { uid: idOrUid }, select: { id: true } });
  return byUid?.id ?? null;
}

/** Maps staff/managed-user JWT ids (and legacy uid values) to the store owner's User.id. */
export async function getOwnerUserId(rawUserId: string): Promise<string> {
  if (!rawUserId) return rawUserId;

  const asUser = await canonicalOwnerId(rawUserId);
  if (asUser) return asUser;

  const managedById = await prisma.managedUser.findUnique({
    where: { id: rawUserId },
    select: { id: true, adminId: true },
  });
  const managed =
    managedById ||
    (await prisma.managedUser.findUnique({
      where: { uid: rawUserId },
      select: { id: true, adminId: true },
    }));

  if (managed?.adminId) {
    const owner = await canonicalOwnerId(managed.adminId);
    if (owner) {
      if (owner !== managed.adminId) {
        try {
          await prisma.managedUser.update({
            where: { id: managed.id },
            data: { adminId: owner },
          });
        } catch {
          // Best-effort repair of legacy adminId=uid rows.
        }
      }
      return owner;
    }
    return managed.adminId;
  }

  return rawUserId;
}
