import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CalendarError } from "@/lib/calendar-server";
import { lockWallet, economyDay } from "@/lib/popcorn-economy";
export async function redeemPromo(userId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "code")) throw new CalendarError(400, "Введите промокод");
  const raw = (input as { code?: unknown }).code;
  if (typeof raw !== "string" || raw.length > 128) throw new CalendarError(400, "Введите промокод");
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) throw new CalendarError(400, "Проверьте промокод: используйте латинские буквы, цифры, дефис или подчёркивание.");
  const now = new Date(), expires = new Date(now.getTime() + 15 * 60 * 1000), key = createHash("sha256").update(`promo:${userId}`).digest("hex");
  const [limit] = await prisma.$queryRaw<{ count: number }[]>`INSERT INTO "AuthRateLimit" ("key","count","expiresAt") VALUES (${key},1,${expires}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "AuthRateLimit"."expiresAt"<=${now} THEN 1 ELSE LEAST("AuthRateLimit"."count"+1,21) END,"expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=${now} THEN ${expires} ELSE "AuthRateLimit"."expiresAt" END RETURNING "count"`;
  if (limit.count > 20) throw new CalendarError(429, "Слишком много попыток. Попробуйте через 15 минут.");
  return prisma.$transaction(async tx => {
    // Same wallet-first lock order as purchases and other balance changes.
    const wallet = await lockWallet(tx, userId);
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "PromoCode" WHERE code=${code} FOR UPDATE`;
    if (!locked.length) throw new CalendarError(404, "Промокод не найден или недоступен.");
    const promo = await tx.promoCode.findUniqueOrThrow({ where: { id: locked[0].id } });
    const used = await tx.promoRedemption.findUnique({ where: { promoCodeId_userId: { promoCodeId: promo.id, userId } } });
    if (used) throw new CalendarError(409, "Вы уже активировали этот промокод.");
    const checkedAt = new Date();
    if (!promo.active || (promo.startsAt && promo.startsAt > checkedAt) || (promo.expiresAt && promo.expiresAt <= checkedAt) || (promo.maxActivations !== null && promo.redeemedCount >= promo.maxActivations)) throw new CalendarError(409, "Промокод не найден или недоступен.");
    if (wallet.popcorn > 2147483647 - promo.reward) throw new CalendarError(409, "Не удалось начислить награду: достигнут максимальный баланс.");
    await tx.promoRedemption.create({ data: { promoCodeId: promo.id, userId, amount: promo.reward } });
    await tx.promoCode.update({ where: { id: promo.id }, data: { redeemedCount: { increment: 1 } } });
    await tx.popcornEntry.create({ data: { userId, eventKey: `promo:${promo.id}`, category: "promo", amount: promo.reward, reason: `Промокод ${code}`, day: economyDay(checkedAt) } });
    const updated = await tx.user.update({ where: { id: userId }, data: { popcorn: { increment: promo.reward } }, select: { popcorn: true } });
    return { success: true, amount: promo.reward, balance: updated.popcorn };
  }, { timeout: 10000 });
}
