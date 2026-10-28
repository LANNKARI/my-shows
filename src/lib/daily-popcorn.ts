import { prisma } from "@/lib/prisma";
import { credit, lockWallet } from "./popcorn-economy";
export const STREAK_REWARDS: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 40,
  7: 50,
};
export function nextDailyStreak(
  last: Date | null,
  streak: number,
  now = new Date(),
) {
  if (!last) return 1;
  const days =
    (Date.parse(now.toISOString().slice(0, 10)) -
      Date.parse(last.toISOString().slice(0, 10))) /
    86400000;
  return days <= 0 ? streak : days === 1 ? (streak % 7) + 1 : 1;
}
export async function claimDaily(
  user: { id: string; lastDailyClaim: Date | null; dailyStreak: number },
  now = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, user.id);
    const fresh = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { lastDailyClaim: true, dailyStreak: true },
    });
    if (
      fresh.lastDailyClaim &&
      fresh.lastDailyClaim.toISOString().slice(0, 10) >=
        now.toISOString().slice(0, 10)
    )
      return null;
    const streak = nextDailyStreak(
        fresh.lastDailyClaim,
        fresh.dailyStreak,
        now,
      ),
      reward = STREAK_REWARDS[streak];
    const paid = await credit(
      tx,
      user.id,
      `daily:${now.toISOString().slice(0, 10)}`,
      "daily",
      reward,
      "Ежедневный бонус",
      now,
    );
    await tx.user.update({
      where: { id: user.id },
      data: { lastDailyClaim: now, dailyStreak: streak },
    });
    return { streak, reward: paid.duplicate ? 0 : paid.amount };
  });
}
// Kept for internal compatibility; public quiz answers use server-owned rounds.
export async function recordQuizAttempt(
  user: { id: string; lastQuizDate: Date | null; quizAttemptsToday: number },
  correct: boolean,
  now = new Date(),
  db = prisma,
) {
  const today = now.toISOString().slice(0, 10),
    last = user.lastQuizDate?.toISOString().slice(0, 10);
  const attempts = last === today ? user.quizAttemptsToday : 0;
  if (attempts >= 10 || (last && last > today)) return null;
  return db.$transaction(async (tx) => {
    await lockWallet(tx, user.id);
    const changed = await tx.user.updateMany({
      where: {
        id: user.id,
        lastQuizDate: user.lastQuizDate,
        quizAttemptsToday: user.quizAttemptsToday,
      },
      data: { lastQuizDate: now, quizAttemptsToday: attempts + 1 },
    });
    if (!changed.count) return null;
    const paid = await credit(
      tx,
      user.id,
      `legacy-quiz:${today}:${attempts + 1}`,
      "game",
      correct ? 5 : 0,
      "Ответ в викторине",
      now,
    );
    return { reward: paid.amount, attemptsLeft: 10 - attempts - 1 };
  });
}
