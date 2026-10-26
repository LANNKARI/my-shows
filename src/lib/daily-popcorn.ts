import { prisma } from "@/lib/prisma";
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
  if (days <= 0) return streak;
  return days === 1 ? (streak % 7) + 1 : 1;
}
export async function claimDaily(
  user: { id: string; lastDailyClaim: Date | null; dailyStreak: number },
  now = new Date(),
) {
  if (
    user.lastDailyClaim &&
    user.lastDailyClaim.toISOString().slice(0, 10) >=
      now.toISOString().slice(0, 10)
  )
    return null;
  const streak = nextDailyStreak(user.lastDailyClaim, user.dailyStreak, now),
    reward = STREAK_REWARDS[streak];
  const changed = await prisma.user.updateMany({
    where: {
      id: user.id,
      lastDailyClaim: user.lastDailyClaim,
      dailyStreak: user.dailyStreak,
    },
    data: {
      popcorn: { increment: reward },
      lastDailyClaim: now,
      dailyStreak: streak,
    },
  });
  return changed.count ? { streak, reward } : null;
}

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
  const reward = correct ? 5 : 0;
  const changed = await db.user.updateMany({
    where: {
      id: user.id,
      lastQuizDate: user.lastQuizDate,
      quizAttemptsToday: user.quizAttemptsToday,
    },
    data: {
      popcorn: { increment: reward },
      lastQuizDate: now,
      quizAttemptsToday: attempts + 1,
    },
  });
  return changed.count ? { reward, attemptsLeft: 10 - attempts - 1 } : null;
}
