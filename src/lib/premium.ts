import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
import { credit, lockWallet } from "./popcorn-economy";
export const PREMIUM_PRICE = 2000,
  PREMIUM_BONUS = 500,
  PREMIUM_PERIOD_MS = 30 * 86400000;
export async function premiumActive(
  userId: string,
  db: Prisma.TransactionClient = prisma,
  now = new Date(),
) {
  return !!(await db.premiumPeriod.findFirst({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { id: true },
  }));
}
export async function settlePremiumBonus(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date(),
) {
  // Every caller holds the user's wallet lock. Period ledger keys prevent duplicate grants.
  const due = await tx.premiumPeriod.findMany({
    where: {
      userId,
      revokedAt: null,
      startsAt: { lte: now },
      bonusPaidAt: null,
    },
  });
  for (const period of due) {
    await credit(
      tx,
      userId,
      `premium-bonus:${period.id}`,
      "premium",
      PREMIUM_BONUS,
      "500 🍿 за период Premium",
      now,
    );
    await tx.premiumPeriod.update({
      where: { id: period.id },
      data: { bonusPaidAt: now },
    });
  }
}
export async function premiumSnapshot(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    await settlePremiumBonus(tx, userId);
    const [user, period, active] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { popcorn: true, premiumBonusTenths: true },
      }),
      tx.premiumPeriod.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { endsAt: "desc" },
      }),
      premiumActive(userId, tx),
    ]);
    return {
      active,
      until: period?.endsAt ?? null,
      balance: user.popcorn,
      bonusTenths: user.premiumBonusTenths,
      price: PREMIUM_PRICE,
    };
  });
}
export async function purchasePremium(userId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CalendarError(400, "Некорректный запрос");
  const b = input as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) => !["requestKey", "expectedUntil", "expectedPrice"].includes(k),
    ) ||
    b.expectedPrice !== PREMIUM_PRICE ||
    typeof b.requestKey !== "string" ||
    !/^\w[\w-]{15,79}$/.test(b.requestKey) ||
    !(
      b.expectedUntil === null ||
      (typeof b.expectedUntil === "string" &&
        Number.isFinite(Date.parse(b.expectedUntil)))
    )
  )
    throw new CalendarError(400, "Обновите страницу и подтвердите покупку");
  return prisma.$transaction(
    async (tx) => {
      await lockWallet(tx, userId);
      const old = await tx.premiumPeriod.findUnique({
        where: {
          userId_requestKey: { userId, requestKey: b.requestKey as string },
        },
      });
      if (old) return { success: true, duplicate: true };
      await settlePremiumBonus(tx, userId);
      const last = await tx.premiumPeriod.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { endsAt: "desc" },
      });
      if ((last?.endsAt.toISOString() ?? null) !== b.expectedUntil)
        throw new CalendarError(
          409,
          "Срок подписки изменился. Обновите страницу перед покупкой.",
        );
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { popcorn: true },
      });
      if (user.popcorn < PREMIUM_PRICE)
        throw new CalendarError(409, "Не хватает попкорнов");
      const now = new Date(),
        startsAt = new Date(
          Math.max(now.getTime(), last?.endsAt.getTime() ?? 0),
        );
      await credit(
        tx,
        userId,
        `premium-purchase:${b.requestKey}`,
        "purchase",
        -PREMIUM_PRICE,
        "Premium на 30 дней",
        now,
      );
      await tx.premiumPeriod.create({
        data: {
          userId,
          requestKey: b.requestKey as string,
          startsAt,
          endsAt: new Date(startsAt.getTime() + PREMIUM_PERIOD_MS),
          source: "purchase",
        },
      });
      await settlePremiumBonus(tx, userId, now);
      return { success: true, duplicate: false };
    },
    { timeout: 15000 },
  );
}
export async function grantPremium(
  tx: Prisma.TransactionClient,
  userId: string,
  periods: number,
) {
  await lockWallet(tx, userId);
  const last = await tx.premiumPeriod.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { endsAt: "desc" },
  });
  let start = Math.max(Date.now(), last?.endsAt.getTime() ?? 0);
  for (let i = 0; i < periods; i++) {
    await tx.premiumPeriod.create({
      data: {
        userId,
        requestKey: `gift-${randomUUID()}`,
        startsAt: new Date(start),
        endsAt: new Date(start + PREMIUM_PERIOD_MS),
        source: "gift",
      },
    });
    start += PREMIUM_PERIOD_MS;
  }
  await settlePremiumBonus(tx, userId);
}
