import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
import {
  lockWallet,
  credit,
  gameEvent,
  economyDay,
  economyView,
} from "./popcorn-economy";
import { gameMoviePool, movieTitleKey, movieImageKey } from "./game-movies";
export const QUIZ_DAILY_LIMIT = 10;
type Question = {
  targetId: number;
  correctTitle: string;
  options: string[];
  backdropUrl: string;
};
const publicQuestion = (row: { id: string; data: Prisma.JsonValue }) => {
  const data = row.data as unknown as Question;
  return {
    roundId: row.id,
    backdropUrl: data.backdropUrl,
    options: data.options,
    limitReached: false,
  };
};
const openWhere = (userId: string, now = new Date()) => ({
  userId,
  answered: false,
  createdAt: { gte: economyDay(now) },
});
export async function quizStatus(
  userId: string,
  db: Prisma.TransactionClient = prisma,
  now = new Date(),
) {
  const day = economyDay(now);
  const [used, completed] = await Promise.all([
    db.popcornQuizRound.count({ where: { userId, createdAt: { gte: day } } }),
    db.popcornQuizRound.aggregate({
      where: { userId, answered: true, createdAt: { gte: day } },
      _count: { _all: true },
      _sum: { reward: true },
    }),
  ]);
  return {
    dailyLimit: QUIZ_DAILY_LIMIT,
    dailyUsed: used,
    dailyAnswered: completed._count._all,
    dailyReward: completed._sum.reward ?? 0,
    attemptsLeft: Math.max(0, QUIZ_DAILY_LIMIT - used),
    nextResetAt: new Date(day.getTime() + 86400000).toISOString(),
  };
}
async function seenMovies(
  userId: string,
  db: Prisma.TransactionClient = prisma,
  now = new Date(),
) {
  return db.$queryRaw<
    { targetId: string | null; title: string | null; image: string | null }[]
  >`SELECT DISTINCT "data"->>'targetId' AS "targetId", "data"->>'correctTitle' AS title, "data"->>'backdropUrl' AS image FROM "PopcornQuizRound" WHERE "userId"=${userId} AND "createdAt">=${new Date(now.getTime() - 7 * 86400000)}`;
}
export async function getQuiz(
  userId: string,
  options: { fetcher?: typeof fetch; apiKey?: string; db?: PrismaClient } = {},
) {
  const db = options.db ?? prisma;
  const now = new Date();
  const status = await quizStatus(userId, db, now);
  const open = await db.popcornQuizRound.findFirst({
    where: openWhere(userId, now),
    orderBy: { createdAt: "desc" },
  });
  if (open && status.dailyUsed <= QUIZ_DAILY_LIMIT)
    return { ...publicQuestion(open), ...status };
  if (status.dailyUsed >= QUIZ_DAILY_LIMIT)
    return { ...status, limitReached: true };
  const seen = await seenMovies(userId, db, now);
  let pool;
  try {
    pool = await gameMoviePool({
      ...options,
      excluded: new Set(seen.map((row) => Number(row.targetId))),
      minimum: 12,
      now,
    });
  } catch {
    throw new CalendarError(
      503,
      "Не удалось подобрать новые кадры без повторов. Попробуйте позже.",
    );
  }
  return db.$transaction(
    async (tx) => {
      // User row lock serializes new rounds across tabs and parallel GETs.
      await lockWallet(tx, userId);
      const latestNow = new Date(),
        latest = await quizStatus(userId, tx, latestNow);
      const existing = await tx.popcornQuizRound.findFirst({
        where: openWhere(userId, latestNow),
        orderBy: { createdAt: "desc" },
      });
      if (existing && latest.dailyUsed <= QUIZ_DAILY_LIMIT)
        return { ...publicQuestion(existing), ...latest };
      if (latest.dailyUsed >= QUIZ_DAILY_LIMIT)
        return { ...latest, limitReached: true };
      const history = await seenMovies(userId, tx, latestNow);
      const ids = new Set(history.map((row) => Number(row.targetId))),
        titles = new Set(
          history.flatMap((row) =>
            row.title ? [movieTitleKey(row.title)] : [],
          ),
        ),
        images = new Set(
          history.flatMap((row) =>
            row.image ? [movieImageKey(row.image)] : [],
          ),
        );
      const candidates = pool.filter(
        (movie) =>
          !ids.has(movie.id) &&
          !titles.has(movieTitleKey(movie.title)) &&
          !images.has(movieImageKey(movie.backdrop_path)),
      );
      if (candidates.length < 4)
        throw new CalendarError(
          503,
          "Новые кадры пока недоступны. Попробуйте позже — повторные фильмы не выдаются.",
        );
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const target = candidates[0],
        choices = candidates.slice(0, 4).map((m) => m.title);
      for (let i = choices.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      const data: Question = {
        targetId: target.id,
        correctTitle: target.title,
        options: choices,
        backdropUrl: `https://image.tmdb.org/t/p/w1280${target.backdrop_path}`,
      };
      const row = await tx.popcornQuizRound.create({
        data: { userId, data: data as unknown as Prisma.InputJsonValue },
      });
      return {
        ...publicQuestion(row),
        ...latest,
        dailyUsed: latest.dailyUsed + 1,
        attemptsLeft: Math.max(0, QUIZ_DAILY_LIMIT - latest.dailyUsed - 1),
      };
    },
    { timeout: 15000 },
  );
}
export async function answerQuiz(
  userId: string,
  roundId: unknown,
  selectedTitle: unknown,
) {
  if (
    typeof roundId !== "string" ||
    roundId.length > 100 ||
    typeof selectedTitle !== "string" ||
    selectedTitle.length > 500
  )
    throw new CalendarError(400, "Некорректный ответ");
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const round = await tx.popcornQuizRound.findFirst({
      where: { id: roundId, userId },
    });
    if (!round) throw new CalendarError(404, "Раунд не найден");
    const data = round.data as unknown as Question;
    if (round.answered)
      return {
        isCorrect: round.correct,
        correctTitle: data.correctTitle,
        reward: 0,
        alreadyAnswered: true,
        originalReward: round.reward,
        ...(await quizStatus(userId, tx)),
      };
    if (
      round.createdAt.getTime() < economyDay().getTime() ||
      (await quizStatus(userId, tx)).dailyUsed > QUIZ_DAILY_LIMIT
    )
      throw new CalendarError(
        409,
        "Раунд предыдущего дня закрыт или дневной лимит достигнут. Загрузите игру заново.",
      );
    if (!data.options.includes(selectedTitle))
      throw new CalendarError(400, "Ответа нет среди вариантов");
    const previous = await tx.popcornQuizRound.findFirst({
      where: { userId, answered: true, createdAt: { gte: economyDay() } },
      orderBy: { createdAt: "desc" },
    });
    const correct = selectedTitle === data.correctTitle,
      streak = correct ? (previous?.correct ? previous.streak : 0) + 1 : 0;
    const paid = await credit(
      tx,
      userId,
      `quiz:${round.id}`,
      "game",
      correct ? 1 : 0,
      correct ? "Верный ответ в викторине" : "Ответ в викторине",
    );
    await gameEvent(tx, userId, `quiz:${round.id}`);
    await tx.popcornQuizRound.update({
      where: { id: round.id },
      data: { answered: true, correct, streak, reward: paid.amount },
    });
    await tx.user.update({
      where: { id: userId },
      data: { lastQuizDate: new Date(), quizAttemptsToday: { increment: 1 } },
    });
    const view = await economyView(userId, tx);
    return {
      isCorrect: correct,
      correctTitle: data.correctTitle,
      reward: paid.amount,
      streak,
      gameEarned: view.gameEarned,
      gameLimit: null,
      ...(await quizStatus(userId, tx)),
    };
  });
}
