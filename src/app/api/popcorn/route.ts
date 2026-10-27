import {
  claimDaily,
  recordQuizAttempt,
  nextDailyStreak,
  STREAK_REWARDS,
} from "@/lib/daily-popcorn";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, safeJson } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

// Функция проверки: есть ли в названии кириллица
function hasCyrillic(str: string): boolean {
  return /[а-яА-ЯёЁ]/.test(str);
}

// Запросы к TMDB
type Movie = {
  id: number;
  title: string;
  backdrop_path?: string | null;
  genre_ids?: number[];
};
type MovieList = { results?: Movie[] };
async function fetchTmdb<T = MovieList>(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T | null> {
  const apiKey =
    process.env.TMDB_API_KEY ||
    process.env.TMDB_READ_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY ||
    "";
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set("language", "ru-RU");
  if (apiKey && !apiKey.startsWith("eyJ")) {
    url.searchParams.set("api_key", apiKey);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  if (apiKey.startsWith("eyJ")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  return await res.json();
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        popcorn: true,
        lastDailyClaim: true,
        dailyStreak: true,
        lastQuizDate: true,
        quizAttemptsToday: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 },
      );
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let canClaimDaily = true;
    const nextStreak = nextDailyStreak(
      user.lastDailyClaim,
      user.dailyStreak || 0,
      now,
    );
    if (
      user.lastDailyClaim &&
      user.lastDailyClaim.toISOString().slice(0, 10) >= todayStr
    )
      canClaimDaily = false;

    let quizAttempts = user.quizAttemptsToday || 0;
    if (user.lastQuizDate) {
      const lastQuizStr = new Date(user.lastQuizDate)
        .toISOString()
        .split("T")[0];
      if (lastQuizStr !== todayStr) {
        quizAttempts = 0;
      }
    }

    // --- ЛОГИКА ВИКТОРИНЫ ---
    if (action === "get-quiz") {
      if (quizAttempts >= 10) {
        return NextResponse.json({
          limitReached: true,
          message: "На сегодня лимит исчерпан! Возвращайтесь завтра.",
          attemptsLeft: 0,
        });
      }

      // Парсим список ID, которые уже показывались в этой сессии
      const excludeParam = searchParams.get("exclude") || "";
      const excludedIds = new Set<number>(
        excludeParam
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id) && id > 0),
      );

      // Ищем уникальный фильм (пробуем до 5 случайных страниц популярных фильмов)
      let targetMovie: Movie | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const randomPage = Math.floor(Math.random() * 8) + 1;
        const data = await fetchTmdb("movie/popular", { page: randomPage });

        const validMovies = (data?.results || []).filter(
          (m: Movie) =>
            m.backdrop_path &&
            m.title &&
            hasCyrillic(m.title) &&
            !excludedIds.has(m.id),
        );

        if (validMovies.length > 0) {
          targetMovie =
            validMovies[Math.floor(Math.random() * validMovies.length)];
          break;
        }
      }

      // Фолбэк: если всё исключено, берем страницу с топ-рейтингом
      if (!targetMovie) {
        const topRated = await fetchTmdb("movie/top_rated", { page: 1 });
        const validFallback = (topRated?.results || []).filter(
          (m: Movie) =>
            m.backdrop_path &&
            m.title &&
            hasCyrillic(m.title) &&
            !excludedIds.has(m.id),
        );
        targetMovie = validFallback[0] || (topRated?.results || [])[0];
      }

      if (!targetMovie) {
        return NextResponse.json(
          { error: "Ошибка подбора фильма" },
          { status: 500 },
        );
      }

      // Подбираем похожие варианты ответов
      const [recsData, similarData] = await Promise.all([
        fetchTmdb(`movie/${targetMovie.id}/recommendations`),
        fetchTmdb(`movie/${targetMovie.id}/similar`),
      ]);

      const candidates: Movie[] = [
        ...(recsData?.results || []),
        ...(similarData?.results || []),
      ];

      const uniqueDistractorsMap = new Map<string, Movie>();
      for (const item of candidates) {
        if (
          item.id !== targetMovie.id &&
          item.title &&
          hasCyrillic(item.title) &&
          item.title.toLowerCase().trim() !==
            targetMovie.title.toLowerCase().trim()
        ) {
          if (!uniqueDistractorsMap.has(item.title)) {
            uniqueDistractorsMap.set(item.title, item);
          }
        }
      }

      let distractors = Array.from(uniqueDistractorsMap.values());

      // Добор по жанрам, если похожих нашлось мало
      const targetGenres = targetMovie.genre_ids || [];
      if (distractors.length < 3 && targetGenres.length > 0) {
        const genreId = targetGenres[0];
        const genreMoviesData = await fetchTmdb("discover/movie", {
          with_genres: genreId,
          sort_by: "popularity.desc",
          "vote_count.gte": 100,
        });

        for (const item of genreMoviesData?.results || []) {
          if (
            item.id !== targetMovie.id &&
            item.title &&
            hasCyrillic(item.title) &&
            !uniqueDistractorsMap.has(item.title)
          ) {
            uniqueDistractorsMap.set(item.title, item);
          }
        }
        distractors = Array.from(uniqueDistractorsMap.values());
      }

      distractors = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);

      const options = [
        targetMovie.title,
        ...distractors.map((d: Movie) => d.title),
      ].sort(() => 0.5 - Math.random());

      return NextResponse.json(
        safeJson({
          limitReached: false,
          attemptsLeft: 10 - quizAttempts,
          attemptsUsed: quizAttempts,
          backdropUrl: `${TMDB_IMAGE_BASE}${targetMovie.backdrop_path}`,
          targetId: targetMovie.id,
          options,
        }),
      );
    }

    return NextResponse.json(
      safeJson({
        popcorn: user.popcorn || 0,
        canClaimDaily,
        dailyStreak: user.dailyStreak || 0,
        nextStreak,
        streakRewards: STREAK_REWARDS,
        quizAttemptsLeft: Math.max(0, 10 - quizAttempts),
      }),
    );
  } catch (err) {
    console.error("Popcorn unavailable", err);
    return NextResponse.json(
      { error: "Не удалось загрузить награды. Попробуйте ещё раз." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "Некорректный запрос" },
        { status: 400 },
      );
    const { action } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (action === "claim-daily") {
      const result = await claimDaily(user, now);
      if (!result)
        return NextResponse.json(
          { error: "Награда уже получена. Обновите баланс." },
          { status: 409 },
        );
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { popcorn: true },
      });
      return NextResponse.json({
        success: true,
        ...result,
        popcorn: updated.popcorn,
      });
    }

    if (action === "submit-quiz") {
      const { targetId, selectedTitle } = body;
      if (
        !Number.isSafeInteger(targetId) ||
        targetId <= 0 ||
        typeof selectedTitle !== "string" ||
        !selectedTitle.trim() ||
        selectedTitle.length > 500
      )
        return NextResponse.json(
          { error: "Некорректный ответ" },
          { status: 400 },
        );

      let quizAttempts = user.quizAttemptsToday || 0;
      if (user.lastQuizDate) {
        const lastQuizStr = new Date(user.lastQuizDate)
          .toISOString()
          .split("T")[0];
        if (lastQuizStr !== todayStr) {
          quizAttempts = 0;
        }
      }

      if (quizAttempts >= 10) {
        return NextResponse.json(
          { error: "На сегодня лимит викторины исчерпан (10 из 10)!" },
          { status: 400 },
        );
      }

      const targetMovie = await fetchTmdb<Movie>(`movie/${targetId}`);
      if (!targetMovie) {
        return NextResponse.json({ error: "Фильм не найден" }, { status: 404 });
      }

      const isCorrect =
        targetMovie.title?.toLowerCase().trim() ===
        selectedTitle?.toLowerCase().trim();
      const result = await recordQuizAttempt(user, isCorrect, now);
      if (!result)
        return NextResponse.json(
          { error: "Попытка уже обработана. Обновите игру." },
          { status: 409 },
        );
      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { popcorn: true },
      });
      return NextResponse.json(
        safeJson({
          isCorrect,
          correctTitle: targetMovie.title,
          reward: result.reward,
          popcorn: updated.popcorn,
          attemptsLeft: result.attemptsLeft,
        }),
      );
    }

    return NextResponse.json(
      { error: "Неизвестное действие" },
      { status: 400 },
    );
  } catch (err) {
    console.error("Popcorn unavailable", err);
    return NextResponse.json(
      { error: "Не удалось загрузить награды. Попробуйте ещё раз." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
