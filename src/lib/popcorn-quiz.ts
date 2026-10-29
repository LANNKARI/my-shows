import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
import {
  lockWallet,
  credit,
  gameEvent,
  economyDay,
  economyView,
} from "./popcorn-economy";
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
const openWhere = (userId: string) => ({
  userId,
  answered: false,
  createdAt: { gte: new Date(Date.now() - 10 * 60000) },
});
export async function getQuiz(userId: string) {
  const open = await prisma.popcornQuizRound.findFirst({
    where: openWhere(userId),
    orderBy: { createdAt: "desc" },
  });
  if (open) return publicQuestion(open);
  if (
    (await prisma.popcornQuizRound.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } },
    })) >= 120
  )
    throw new CalendarError(429, "Слишком много раундов. Попробуйте позже.");
  const key =
    process.env.TMDB_API_KEY ||
    process.env.TMDB_READ_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!key) throw new CalendarError(503, "Подбор кадров временно недоступен");
  type Movie = { id: number; title: string; backdrop_path: string };
  const results = await Promise.all(
    ["popular", "top_rated"].map(async (category) => {
      const url = new URL(`https://api.themoviedb.org/3/movie/${category}`);
      url.searchParams.set("language", "ru-RU");
      url.searchParams.set("page", String(randomInt(1, 9)));
      if (!key.startsWith("eyJ")) url.searchParams.set("api_key", key);
      const r = await fetch(url, {
        headers: key.startsWith("eyJ")
          ? { Authorization: `Bearer ${key}` }
          : {},
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 3600 },
      });
      if (!r.ok) throw new CalendarError(503, "Не удалось подобрать кадр");
      return (await r.json()).results as Movie[];
    }),
  );
  const pool = [
    ...new Map(
      results
        .flat()
        .filter(
          (m) =>
            m?.id &&
            typeof m.title === "string" &&
            /[а-яА-Я]/.test(m.title) &&
            typeof m.backdrop_path === "string" &&
            /^\/[a-zA-Z0-9._-]+$/.test(m.backdrop_path),
        )
        .map((m) => [m.title, m]),
    ).values(),
  ];
  if (pool.length < 4)
    throw new CalendarError(503, "Недостаточно вариантов для раунда");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const target = pool[0];
  const options = pool.slice(0, 4).map((m) => m.title);
  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  const data: Question = {
    targetId: target.id,
    correctTitle: target.title,
    options,
    backdropUrl: `https://image.tmdb.org/t/p/original${target.backdrop_path}`,
  };
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const existing = await tx.popcornQuizRound.findFirst({
      where: openWhere(userId),
      orderBy: { createdAt: "desc" },
    });
    if (existing) return publicQuestion(existing);
    return publicQuestion(
      await tx.popcornQuizRound.create({
        data: { userId, data: data as unknown as Prisma.InputJsonValue },
      }),
    );
  });
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
      };
    if (round.createdAt.getTime() < Date.now() - 10 * 60000)
      throw new CalendarError(
        409,
        "Время раунда истекло. Загрузите новый кадр.",
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
    };
  });
}
