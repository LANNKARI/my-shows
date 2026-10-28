import { lockWallet, economyDay } from "./popcorn-economy";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cosmeticItem,
  frameId,
  profileStyleId,
  COSMETICS,
} from "@/lib/cosmetics";
import { summarizeLibrary } from "@/lib/progress";
const userSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  popcorn: true,
  avatarFrame: true,
  profileStyle: true,
};
export class CosmeticError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function cosmeticsSnapshot(userId: string) {
  const [user, purchases, library] = await prisma.$transaction(
    async (tx) =>
      Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: userSelect }),
        tx.cosmeticPurchase.findMany({
          where: { userId },
          select: { itemId: true, pricePaid: true, purchasedAt: true },
          orderBy: { purchasedAt: "desc" },
        }),
        tx.userShow.findMany({
          where: { userId },
          include: {
            show: { include: { episodes: true } },
            progress: true,
            ratings: true,
          },
        }),
      ]),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  if (!user) throw new CosmeticError(401, "Войдите в аккаунт");
  const stats = summarizeLibrary(library);
  return {
    user: {
      ...user,
      avatarFrame: frameId(user.avatarFrame),
      profileStyle: profileStyleId(user.profileStyle),
    },
    catalog: COSMETICS,
    purchases,
    stats: {
      moviesCount: stats.completedCount - stats.completedSeriesCount,
      seriesCount: stats.completedSeriesCount,
      ratingsCount: stats.ratingsCount,
      hoursWatched: stats.hoursWatched,
    },
  };
}
export async function mutateCosmetics(userId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CosmeticError(400, "Некорректный запрос");
  const body = input as Record<string, unknown>;
  if (
    (body.action !== "purchase" && body.action !== "equip") ||
    typeof body.itemId !== "string" ||
    body.itemId.length > 80 ||
    Object.keys(body).some(
      (key) => !["action", "itemId", "expectedPrice"].includes(key),
    )
  )
    throw new CosmeticError(400, "Некорректный запрос");
  const item = cosmeticItem(body.itemId);
  if (!item) throw new CosmeticError(400, "Предмет не найден");
  if (
    body.action === "purchase" &&
    (typeof body.expectedPrice !== "number" ||
      !Number.isSafeInteger(body.expectedPrice) ||
      body.expectedPrice < 0)
  )
    throw new CosmeticError(400, "Обновите магазин перед покупкой");
  return prisma.$transaction(
    async (tx) => {
      // Serialize this user's purchases, including two different items from two tabs.
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (!locked.length) throw new CosmeticError(401, "Войдите в аккаунт");
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: userSelect,
      });
      const purchase = await tx.cosmeticPurchase.findUnique({
        where: { userId_itemId: { userId, itemId: item.id } },
      });
      if (body.action === "purchase") {
        if (!item.price)
          throw new CosmeticError(
            400,
            "Бесплатное оформление можно выбрать сразу",
          );
        if (purchase)
          return {
            success: true,
            alreadyOwned: true,
            itemId: item.id,
            user,
            purchase,
          };
        if (body.expectedPrice !== item.price)
          throw new CosmeticError(
            409,
            "Цена изменилась. Обновите магазин и подтвердите новую стоимость.",
          );
        await lockWallet(tx, userId);
        const charged = await tx.user.updateMany({
          where: { id: userId, popcorn: { gte: item.price } },
          data: { popcorn: { decrement: item.price } },
        });
        if (!charged.count)
          throw new CosmeticError(
            409,
            "Не хватает попкорна. Баланс мог измениться в другой вкладке.",
          );
        await tx.popcornEntry.create({
          data: {
            userId,
            eventKey: `purchase:${item.id}`,
            category: "purchase",
            amount: -item.price,
            reason: `Покупка: ${item.name}`,
            day: economyDay(),
          },
        });
        const created = await tx.cosmeticPurchase.create({
          data: { userId, itemId: item.id, pricePaid: item.price },
        });
        return {
          success: true,
          alreadyOwned: false,
          itemId: item.id,
          user: { ...user, popcorn: user.popcorn - item.price },
          purchase: created,
        };
      }
      if (item.price > 0 && !purchase)
        throw new CosmeticError(403, "Сначала приобретите этот предмет");
      const selected = await tx.user.update({
        where: { id: userId },
        data:
          item.kind === "frame"
            ? { avatarFrame: item.id }
            : { profileStyle: item.id },
        select: userSelect,
      });
      return { success: true, itemId: item.id, user: selected };
    },
    { timeout: 10000 },
  );
}
