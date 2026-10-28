import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import {
  claimDaily,
  nextDailyStreak,
  STREAK_REWARDS,
} from "@/lib/daily-popcorn";
import { claimTask, economyView } from "@/lib/popcorn-economy";
import { getQuiz, answerQuiz } from "@/lib/popcorn-quiz";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request);
    if (request.nextUrl.searchParams.get("action") === "get-quiz")
      return privateJson(await getQuiz(userId));
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { popcorn: true, lastDailyClaim: true, dailyStreak: true },
    });
    return privateJson({
      ...(await economyView(userId)),
      popcorn: user.popcorn,
      canClaimDaily:
        !user.lastDailyClaim ||
        user.lastDailyClaim.toISOString().slice(0, 10) <
          new Date().toISOString().slice(0, 10),
      dailyStreak: user.dailyStreak,
      nextStreak: nextDailyStreak(user.lastDailyClaim, user.dailyStreak),
      streakRewards: STREAK_REWARDS,
      quizAttemptsLeft: 10,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new CalendarError(400, "Некорректный запрос");
    if (body.action === "claim-daily") {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, lastDailyClaim: true, dailyStreak: true },
      });
      const result = await claimDaily(user);
      if (!result) throw new CalendarError(409, "Награда уже получена");
      return privateJson({
        success: true,
        ...result,
        popcorn: (
          await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { popcorn: true },
          })
        ).popcorn,
      });
    }
    if (body.action === "claim-task")
      return privateJson(await claimTask(userId, body.taskId));
    if (body.action === "submit-quiz") {
      if (
        Object.keys(body).some(
          (k) => !["action", "roundId", "selectedTitle"].includes(k),
        )
      )
        throw new CalendarError(400, "Некорректный запрос");
      return privateJson(
        await answerQuiz(userId, body.roundId, body.selectedTitle),
      );
    }
    throw new CalendarError(400, "Неизвестное действие");
  } catch (e) {
    return calendarFailure(e);
  }
}
