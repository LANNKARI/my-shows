import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
export const ROLE_PERMISSIONS = {
  moderate_comments: "Удаление комментариев",
  curate: "Официальные подборки",
  beta: "Доступ к тестовым функциям",
} as const;
export type RolePermission = keyof typeof ROLE_PERMISSIONS;
export async function isSiteOwner(
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  return !!(await db.siteOwner.findFirst({
    where: { id: 1, userId },
    select: { id: true },
  }));
}
export async function requireOwner(
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  if (!(await isSiteOwner(userId, db)))
    throw new CalendarError(403, "Доступ только для администратора сайта");
}
export async function hasPermission(
  userId: string,
  permission: RolePermission,
  db: Prisma.TransactionClient = prisma,
) {
  return (
    (await isSiteOwner(userId, db)) ||
    !!(await db.userRole.findFirst({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        role: { permissions: { has: permission } },
      },
      select: { roleId: true },
    }))
  );
}
export async function publicAccountBadges(
  userIds: string[],
  db: Prisma.TransactionClient = prisma,
) {
  const ids = [...new Set(userIds)];
  if (!ids.length)
    return {} as Record<
      string,
      { roleId?: string; name: string; color: string; icon: string }[]
    >;
  const now = new Date();
  const [owners, roles, premium] = await Promise.all([
    db.siteOwner.findMany({
      where: { userId: { in: ids } },
      select: { userId: true },
    }),
    db.userRole.findMany({
      where: {
        userId: { in: ids },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { role: true },
      orderBy: { roleId: "asc" },
    }),
    db.premiumPeriod.findMany({
      where: {
        userId: { in: ids },
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { userId: true },
    }),
  ]);
  const result: Record<
    string,
    { roleId?: string; name: string; color: string; icon: string }[]
  > = {};
  ids.forEach((id) => (result[id] = []));
  owners.forEach((r) =>
    result[r.userId].push({
      roleId: "owner",
      name: "Администратор",
      color: "#c1a4ff",
      icon: "⚑",
    }),
  );
  [...new Set(premium.map((p) => p.userId))].forEach((id) =>
    result[id].push({
      roleId: "premium",
      name: "Premium",
      color: "#d5af69",
      icon: "✦",
    }),
  );
  roles.forEach((r) =>
    result[r.userId].push({
      roleId: r.roleId,
      name: r.role.name,
      color: r.role.color,
      icon: r.role.icon,
    }),
  );
  return result;
}
export function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  target: string,
  details: Prisma.InputJsonValue,
) {
  return tx.adminAudit.create({ data: { actorId, action, target, details } });
}
