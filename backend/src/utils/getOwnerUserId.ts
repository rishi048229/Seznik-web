import prisma from '../config/db';

/** Maps staff/managed-user JWT ids to the store owner's User.id for shared data queries. */
export async function getOwnerUserId(rawUserId: string): Promise<string> {
  if (!rawUserId) return rawUserId;

  const user = await prisma.user.findUnique({ where: { id: rawUserId } });
  if (user) return user.id;

  const managedUser = await prisma.managedUser.findUnique({ where: { id: rawUserId } });
  if (managedUser?.adminId) return managedUser.adminId;

  return rawUserId;
}
