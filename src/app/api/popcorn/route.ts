import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const STREAK_REWARDS: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
  6: 40,
  7: 50,
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

// Функция проверки: есть ли в названии кириллица
function hasCyrillic(str: string): boolean {
  return /[а-яА-ЯёЁ]/.test(str);
}

// Запросы к TMDB
async function fetchTmdb(endpoint: string, params: Record<string, any> = {}) {
  const apiKey =
    process.env.TMDB_API_KEY ||
    process.env.TMDB_READ_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY ||
    '';
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.set('language', 'ru-RU');
  if (apiKey && !apiKey.startsWith('eyJ')) {
    url.searchParams.set('api_key', apiKey);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {};
  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  return await res.json();
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

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
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let canClaimDaily = true;
    let nextStreak = (user.dailyStreak || 0) + 1;
    if (nextStreak > 7) nextStreak = 1;

    if (user.lastDailyClaim) {
      const lastClaimStr = new Date(user.lastDailyClaim).toISOString().split('T')[0];
      if (lastClaimStr === todayStr) {
        canClaimDaily = false;
        nextStreak = user.dailyStreak;
      } else {
        const diffDays = Math.floor((now.getTime() - new Date(user.lastDailyClaim).getTime()) / (1000 * 3600 * 24));
        if (diffDays > 1) {
          nextStreak = 1;
        }
      }
    } else {
      nextStreak = 1;
    }

    let quizAttempts = user.quizAttemptsToday || 0;
    if (user.lastQuizDate) {
      const lastQuizStr = new Date(user.lastQuizDate).toISOString().split('T')[0];
      if (lastQuizStr !== todayStr) {
        quizAttempts = 0;
      }
    }

    // --- ЛОГИКА ВИКТОРИНЫ ---
    if (action === 'get-quiz') {
      if (quizAttempts >= 10) {
        return NextResponse.json({
          limitReached: true,
          message: 'На сегодня лимит исчерпан! Возвращайтесь завтра.',
          attemptsLeft: 0,
        });
      }

      // Парсим список ID, которые уже показывались в этой сессии
      const excludeParam = searchParams.get('exclude') || '';
      const excludedIds = new Set<number>(
        excludeParam
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id) && id > 0)
      );

      // Ищем уникальный фильм (пробуем до 5 случайных страниц популярных фильмов)
      let targetMovie: any = null;
      let poolOfCandidates: any[] = [];

      for (let attempt = 0; attempt < 5; attempt++) {
        const randomPage = Math.floor(Math.random() * 8) + 1;
        const data = await fetchTmdb('movie/popular', { page: randomPage });

        const validMovies = (data?.results || []).filter(
          (m: any) =>
            m.backdrop_path &&
            m.title &&
            hasCyrillic(m.title) &&
            !excludedIds.has(m.id)
        );

        if (validMovies.length > 0) {
          poolOfCandidates = validMovies;
          targetMovie = validMovies[Math.floor(Math.random() * validMovies.length)];
          break;
        }
      }

      // Фолбэк: если всё исключено, берем страницу с топ-рейтингом
      if (!targetMovie) {
        const topRated = await fetchTmdb('movie/top_rated', { page: 1 });
        const validFallback = (topRated?.results || []).filter(
          (m: any) => m.backdrop_path && m.title && hasCyrillic(m.title) && !excludedIds.has(m.id)
        );
        targetMovie = validFallback[0] || (topRated?.results || [])[0];
      }

      if (!targetMovie) {
        return NextResponse.json({ error: 'Ошибка подбора фильма' }, { status: 500 });
      }

      // Подбираем похожие варианты ответов
      const [recsData, similarData] = await Promise.all([
        fetchTmdb(`movie/${targetMovie.id}/recommendations`),
        fetchTmdb(`movie/${targetMovie.id}/similar`),
      ]);

      const candidates: any[] = [
        ...(recsData?.results || []),
        ...(similarData?.results || []),
      ];

      const uniqueDistractorsMap = new Map<string, any>();
      for (const item of candidates) {
        if (
          item.id !== targetMovie.id &&
          item.title &&
          hasCyrillic(item.title) &&
          item.title.toLowerCase().trim() !== targetMovie.title.toLowerCase().trim()
        ) {
          if (!uniqueDistractorsMap.has(item.title)) {
            uniqueDistractorsMap.set(item.title, item);
          }
        }
      }

      let distractors = Array.from(uniqueDistractorsMap.values());

      // Добор по жанрам, если похожих нашлось мало
      if (distractors.length < 3 && targetMovie.genre_ids?.length > 0) {
        const genreId = targetMovie.genre_ids[0];
        const genreMoviesData = await fetchTmdb('discover/movie', {
          with_genres: genreId,
          sort_by: 'popularity.desc',
          'vote_count.gte': 100,
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
        ...distractors.map((d: any) => d.title),
      ].sort(() => 0.5 - Math.random());

      return NextResponse.json(
        safeJson({
          limitReached: false,
          attemptsLeft: 10 - quizAttempts,
          attemptsUsed: quizAttempts,
          backdropUrl: `${TMDB_IMAGE_BASE}${targetMovie.backdrop_path}`,
          targetId: targetMovie.id,
          options,
        })
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
      })
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (action === 'claim-daily') {
      if (user.lastDailyClaim) {
        const lastStr = new Date(user.lastDailyClaim).toISOString().split('T')[0];
        if (lastStr === todayStr) {
          return NextResponse.json({ error: 'Сегодня вы уже забрали награду!' }, { status: 400 });
        }
      }

      let streak = (user.dailyStreak || 0) + 1;
      if (user.lastDailyClaim) {
        const diffDays = Math.floor((now.getTime() - new Date(user.lastDailyClaim).getTime()) / (1000 * 3600 * 24));
        if (diffDays > 1) streak = 1;
      }
      if (streak > 7) streak = 1;

      const reward = STREAK_REWARDS[streak] || 10;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          popcorn: { increment: reward },
          lastDailyClaim: now,
          dailyStreak: streak,
        },
      });

      return NextResponse.json(
        safeJson({
          success: true,
          reward,
          streak,
          popcorn: updated.popcorn,
        })
      );
    }

    if (action === 'submit-quiz') {
      const { targetId, selectedTitle } = body;

      let quizAttempts = user.quizAttemptsToday || 0;
      if (user.lastQuizDate) {
        const lastQuizStr = new Date(user.lastQuizDate).toISOString().split('T')[0];
        if (lastQuizStr !== todayStr) {
          quizAttempts = 0;
        }
      }

      if (quizAttempts >= 10) {
        return NextResponse.json(
          { error: 'На сегодня лимит викторины исчерпан (10 из 10)!' },
          { status: 400 }
        );
      }

      const targetMovie = await fetchTmdb(`movie/${targetId}`);
      if (!targetMovie) {
        return NextResponse.json({ error: 'Фильм не найден' }, { status: 404 });
      }

      const isCorrect = targetMovie.title?.toLowerCase().trim() === selectedTitle?.toLowerCase().trim();
      const reward = isCorrect ? 5 : 0;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          popcorn: isCorrect ? { increment: reward } : undefined,
          lastQuizDate: now,
          quizAttemptsToday: quizAttempts + 1,
        },
      });

      return NextResponse.json(
        safeJson({
          isCorrect,
          correctTitle: targetMovie.title,
          reward,
          popcorn: updated.popcorn,
          attemptsLeft: 10 - (quizAttempts + 1),
        })
      );
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}