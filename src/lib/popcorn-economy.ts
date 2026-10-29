import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
export type EconomyTx = Prisma.TransactionClient;
export const economyDay = (now = new Date()) =>
  new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
export const titleIdentity = (show: {
  id: number;
  kind: string;
  tmdbId: number | null;
}) => `${show.kind}:${show.tmdbId ? "tmdb:" + show.tmdbId : "show:" + show.id}`;
export async function lockWallet(tx: EconomyTx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { popcorn: true },
  });
  await tx.popcornEntry.upsert({
    where: { userId_eventKey: { userId, eventKey: "opening" } },
    create: {
      userId,
      eventKey: "opening",
      category: "opening",
      amount: user.popcorn,
      reason: "Начальный баланс",
      day: economyDay(),
    },
    update: {},
  });
  // Old deployment requests can finish between SQL migration and code rollout.
  // Reconcile their net effect into the journal without changing the real wallet.
  const recorded =
    (
      await tx.popcornEntry.aggregate({
        where: { userId },
        _sum: { amount: true },
      })
    )._sum.amount || 0;
  if (recorded !== user.popcorn)
    await tx.popcornEntry.create({
      data: {
        userId,
        eventKey: `reconcile:${randomUUID()}`,
        category: "adjustment",
        amount: user.popcorn - recorded,
        reason: "Сверка баланса после обновления",
        day: economyDay(),
      },
    });
  return user;
}
export async function activityEvents(
  tx: EconomyTx,
  userId: string,
  events: { key: string; amount: number; reason: string }[],
  now = new Date(),
) {
  if (!events.length) return 0;
  await lockWallet(tx, userId);
  const day = economyDay(now);
  const old = await tx.popcornEntry.findMany({
    where: { userId, eventKey: { in: events.map((e) => e.key) } },
    select: { eventKey: true },
  });
  const seen = new Set(old.map((e) => e.eventKey));
  let budget =
    60 -
    ((
      await tx.popcornEntry.aggregate({
        where: { userId, day, category: "activity" },
        _sum: { amount: true },
      })
    )._sum.amount || 0);
  let total = 0;
  const data = events
    .filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    })
    .map((e) => {
      const amount = Math.max(0, Math.min(e.amount, budget));
      budget -= amount;
      total += amount;
      return {
        userId,
        eventKey: e.key,
        category: "activity",
        amount,
        reason: e.reason,
        day,
      };
    });
  if (data.length) await tx.popcornEntry.createMany({ data });
  if (total)
    await tx.user.update({
      where: { id: userId },
      data: { popcorn: { increment: total } },
    });
  return total;
}
export async function credit(
  tx: EconomyTx,
  userId: string,
  eventKey: string,
  category: string,
  wanted: number,
  reason: string,
  now = new Date(),
) {
  await lockWallet(tx, userId);
  const existing = await tx.popcornEntry.findUnique({
    where: { userId_eventKey: { userId, eventKey } },
  });
  if (existing) return { amount: existing.amount, duplicate: true };
  const day = economyDay(now);
  const amount = wanted;
  await tx.popcornEntry.create({
    data: { userId, eventKey, category, amount, reason, day },
  });
  if (amount)
    await tx.user.update({
      where: { id: userId },
      data: { popcorn: { increment: amount } },
    });
  return { amount, duplicate: false };
}
export async function gameEvent(
  tx: EconomyTx,
  userId: string,
  key: string,
  now = new Date(),
) {
  await tx.popcornEntry.upsert({
    where: { userId_eventKey: { userId, eventKey: `game-event:${key}` } },
    create: {
      userId,
      eventKey: `game-event:${key}`,
      category: "game-event",
      amount: 0,
      reason: "Завершён игровой раунд",
      day: economyDay(now),
    },
    update: {},
  });
}
export const tasks = [
  { id: "episodes", name: "Просмотреть 2 серии", target: 2, reward: 10 },
  { id: "ratings", name: "Оценить 3 тайтла", target: 3, reward: 15 },
  { id: "games", name: "Завершить 2 игровых раунда", target: 2, reward: 20 },
] as const;
export async function economyView(
  userId: string,
  db: EconomyTx = prisma,
  now = new Date(),
) {
  const day = economyDay(now),
    prefix = now.toISOString().slice(0, 10);
  const [row] = await db.$queryRaw<
    {
      activity: bigint;
      games: bigint;
      episodes: bigint;
      ratings: bigint;
      rounds: bigint;
      episodesClaimed: bigint;
      ratingsClaimed: bigint;
      gamesClaimed: bigint;
      allClaimed: bigint;
    }[]
  >`
 SELECT COALESCE(SUM("amount") FILTER (WHERE "category"='activity'),0) AS activity,
 COALESCE(SUM("amount") FILTER (WHERE "category"='game'),0) AS games,
 COUNT(*) FILTER (WHERE "category"='activity' AND "eventKey" LIKE 'watch:series:%') AS episodes,
 COUNT(*) FILTER (WHERE "category"='activity' AND "eventKey" LIKE 'rating:%') AS ratings,
 COUNT(*) FILTER (WHERE "category"='game-event') AS rounds,
 COUNT(*) FILTER (WHERE "eventKey"=${`task:${prefix}:episodes`}) AS "episodesClaimed",
 COUNT(*) FILTER (WHERE "eventKey"=${`task:${prefix}:ratings`}) AS "ratingsClaimed",
 COUNT(*) FILTER (WHERE "eventKey"=${`task:${prefix}:games`}) AS "gamesClaimed",
 COUNT(*) FILTER (WHERE "eventKey"=${`task:${prefix}:all`}) AS "allClaimed"
 FROM "PopcornEntry" WHERE "userId"=${userId} AND "day"=${day} AND "category" IN ('activity','game','task','game-event')`;
  const quests = tasks.map((t) => ({
    ...t,
    count: Math.min(
      t.target,
      Number(
        t.id === "episodes"
          ? row.episodes
          : t.id === "ratings"
            ? row.ratings
            : row.rounds,
      ),
    ),
    claimed:
      Number(
        t.id === "episodes"
          ? row.episodesClaimed
          : t.id === "ratings"
            ? row.ratingsClaimed
            : row.gamesClaimed,
      ) > 0,
  }));
  return {
    activityEarned: Number(row.activity),
    activityLimit: 60,
    gameEarned: Number(row.games),
    gameLimit: null,
    tasks: quests,
    allTasksClaimed: Number(row.allClaimed) > 0,
    nextResetAt: new Date(day.getTime() + 86400000).toISOString(),
  };
}
export async function claimTask(userId: string, id: unknown) {
  if (![...tasks.map((t) => t.id), "all"].includes(id as never))
    throw new CalendarError(400, "Неизвестное задание");
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const now = new Date();
    const view = await economyView(userId, tx, now);
    const task = view.tasks.find((t) => t.id === id);
    if (
      id === "all"
        ? !view.tasks.every((t) => t.claimed)
        : !task || task.count < task.target
    )
      throw new CalendarError(409, "Задание пока не выполнено");
    const result = await credit(
      tx,
      userId,
      `task:${now.toISOString().slice(0, 10)}:${id}`,
      "task",
      id === "all" ? 10 : task!.reward,
      id === "all" ? "Все задания дня" : task!.name,
      now,
    );
    return {
      reward: result.duplicate ? 0 : result.amount,
      alreadyClaimed: result.duplicate,
    };
  });
}
