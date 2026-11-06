import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
import {
  hasPermission,
  requireOwner,
  ROLE_PERMISSIONS,
} from "./account-access";
import { grantPremium } from "./premium";
const bad = (message = "Некорректные данные"): never => {
  throw new CalendarError(400, message);
};
function text(v: unknown, max = 100) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) return bad();
  return v.trim();
}
function integer(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    return bad();
  return v;
}
function date(v: unknown) {
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v))) return bad();
  return new Date(v);
}
export async function adminSnapshot(
  actorId: string,
  tab: string,
  q: string,
  offset: number,
) {
  if (tab === "comments") {
    if (!(await hasPermission(actorId, "moderate_comments")))
      throw new CalendarError(403, "Недостаточно прав");
  } else await requireOwner(actorId);
  if (
    !["users", "promos", "comments", "audit"].includes(tab) ||
    q.length > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    bad();
  const roles = await prisma.siteRole.findMany({ orderBy: { name: "asc" } });
  if (tab === "users") {
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true,
        username: true,
        name: true,
        siteOwner: { select: { id: true } },
        roles: { include: { role: true } },
        premiumPeriods: {
          where: { revokedAt: null, endsAt: { gt: new Date() } },
          select: { startsAt: true, endsAt: true },
          orderBy: { endsAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: 31,
    });
    return { roles, items: users.slice(0, 30), hasMore: users.length > 30 };
  }
  if (tab === "promos") {
    const items = await prisma.promoCode.findMany({
      where: q ? { code: { contains: q.toUpperCase() } } : {},
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: 31,
    });
    return { roles, items: items.slice(0, 30), hasMore: items.length > 30 };
  }
  if (tab === "comments") {
    const items = await prisma.comment.findMany({
      where: q ? { text: { contains: q, mode: "insensitive" } } : {},
      include: {
        user: { select: { username: true } },
        show: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: 31,
    });
    return { roles, items: items.slice(0, 30), hasMore: items.length > 30 };
  }
  const items = await prisma.adminAudit.findMany({
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: 31,
  });
  return { roles, items: items.slice(0, 30), hasMore: items.length > 30 };
}
export async function adminMutation(actorId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) bad();
  const b = input as Record<string, unknown>,
    action = text(b.action),
    requestKey = text(b.requestKey, 80);
  if (!/^[\w-]{16,80}$/.test(requestKey)) bad();
  const allowed: Record<string, string[]> = {
    roleSave: ["roleId", "name", "color", "icon", "permissions"],
    roleDelete: ["roleId"],
    roleGrant: ["userId", "roleId", "expiresAt"],
    roleRevoke: ["userId", "roleId"],
    premiumGrant: ["userId", "periods"],
    premiumRevoke: ["userId"],
    promoCreate: ["code", "reward", "startsAt", "expiresAt", "maxActivations"],
    promoToggle: ["promoId", "active"],
  };
  if (
    !allowed[action] ||
    Object.keys(b).some(
      (k) => !["action", "requestKey", ...allowed[action]].includes(k),
    )
  )
    bad();
  return prisma.$transaction(
    async (tx) => {
      await requireOwner(actorId, tx);
      // Serialize owner mutations and make retries (including grants) idempotent.
      await tx.$queryRaw`SELECT id FROM "SiteOwner" WHERE id=1 FOR UPDATE`;
      if (
        await tx.adminAudit.findFirst({
          where: { requestKey },
          select: { id: true },
        })
      )
        return { success: true, duplicate: true };
      let target = "";
      if (action === "roleSave") {
        const name = text(b.name, 40),
          color = text(b.color, 7),
          icon = text(b.icon, 8);
        if (
          ["администратор", "premium", "администратор сайта"].includes(
            name.toLowerCase(),
          ) ||
          !/^#[0-9a-f]{6}$/i.test(color) ||
          !Array.isArray(b.permissions) ||
          b.permissions.some(
            (p) => typeof p !== "string" || !(p in ROLE_PERMISSIONS),
          ) ||
          b.permissions.length > 3
        )
          bad();
        const data = {
          name,
          color,
          icon,
          permissions: [...new Set(b.permissions as string[])],
        };
        target = b.roleId ? text(b.roleId, 80) : `custom-${randomUUID()}`;
        if (b.roleId) await tx.siteRole.update({ where: { id: target }, data });
        else await tx.siteRole.create({ data: { id: target, ...data } });
      } else if (action === "roleDelete") {
        target = text(b.roleId, 80);
        await tx.siteRole.delete({ where: { id: target } });
      } else if (action === "roleGrant" || action === "roleRevoke") {
        target = text(b.userId, 80);
        const roleId = text(b.roleId, 80);
        if (
          !(await tx.user.findUnique({
            where: { id: target },
            select: { id: true },
          })) ||
          !(await tx.siteRole.findUnique({
            where: { id: roleId },
            select: { id: true },
          }))
        )
          bad("Пользователь или роль не найдены");
        if (action === "roleRevoke")
          await tx.userRole.deleteMany({ where: { userId: target, roleId } });
        else {
          const expiresAt = date(b.expiresAt);
          if (expiresAt && expiresAt <= new Date())
            bad("Срок роли должен быть в будущем");
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: target, roleId } },
            create: { userId: target, roleId, expiresAt },
            update: { expiresAt },
          });
        }
      } else if (action === "premiumGrant" || action === "premiumRevoke") {
        target = text(b.userId, 80);
        if (
          !(await tx.user.findUnique({
            where: { id: target },
            select: { id: true },
          }))
        )
          bad("Пользователь не найден");
        if (action === "premiumGrant")
          await grantPremium(tx, target, integer(b.periods, 1, 12));
        else {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id=${target} FOR UPDATE`;
          await tx.premiumPeriod.updateMany({
            where: {
              userId: target,
              revokedAt: null,
              endsAt: { gt: new Date() },
            },
            data: { revokedAt: new Date() },
          });
        }
      } else if (action === "promoCreate") {
        const code = text(b.code, 64).toUpperCase();
        if (!/^[A-Z0-9_-]{3,64}$/.test(code))
          bad("Код: 3–64 символа A–Z, 0–9, _ или -");
        const reward = integer(b.reward, 1, 1000000),
          startsAt = date(b.startsAt),
          expiresAt = date(b.expiresAt),
          maxActivations =
            b.maxActivations === null
              ? null
              : integer(b.maxActivations, 1, 1000000);
        if (
          expiresAt &&
          (expiresAt <= new Date() || (startsAt && expiresAt <= startsAt))
        )
          bad("Проверьте даты промокода");
        const p = await tx.promoCode.create({
          data: {
            code,
            reward,
            startsAt,
            expiresAt,
            maxActivations,
            active: true,
          },
        });
        target = String(p.id);
      } else if (action === "promoToggle") {
        const id = integer(b.promoId, 1, 2147483647);
        if (typeof b.active !== "boolean") bad();
        await tx.promoCode.update({
          where: { id },
          data: { active: b.active as boolean },
        });
        target = String(id);
      }
      const { requestKey: unused, ...details } = b;
      void unused;
      await tx.adminAudit.create({
        data: {
          actorId,
          requestKey,
          action,
          target,
          details: JSON.parse(JSON.stringify(details)),
        },
      });
      return { success: true };
    },
    { timeout: 15000 },
  );
}
