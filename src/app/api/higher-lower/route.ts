import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson, formatPosterUrl } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const MAX_DAILY_ATTEMPTS = 5;
const ROUND_REWARDS = [1, 2, 3, 4, 5];

function hasCyrillic(str: string): boolean {
  return /[а-яА-ЯёЁ]/.test(str);
}

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
  const res = await fetch(url.toString(), { headers, next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return await res.json();
}

// Загрузка пула культовых и известных фильмов
async function getTopMoviesPool(): Promise<any[]> {
  const page1 = Math.floor(Math.random() * 15) + 1;
  const page2 = Math.floor(Math.random() * 15) + 1;

  const [res1, res2] = await Promise.all([
    fetchTmdb('discover/movie', {
      sort_by: 'popularity.desc',
      'vote_count.gte': 2500,
      page: page1,
    }),
    fetchTmdb('discover/movie', {
      sort_by: 'popularity.desc',
      'vote_count.gte': 2500,
      page: page2,
    }),
  ]);

  const raw = [...(res1?.results || []), ...(res2?.results || [])];
  const filtered = raw.filter(
    (m: any) =>
      m.poster_path &&
      m.title &&
      hasCyrillic(m.title) &&
      m.vote_average &&
      m.release_date
  );

  return filtered;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const round = parseInt(searchParams.get('round') || '1', 10);
    const excludeParam = searchParams.get('exclude') || '';
    const excludedIds = new Set<number>(
      excludeParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0)
    );

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        popcorn: true,
        lastHigherLowerDate: true,
        higherLowerAttempts: true,
        higherLowerCompleted: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let attemptsUsed = user.higherLowerAttempts || 0;
    let isCompletedToday = user.higherLowerCompleted || false;

    if (user.lastHigherLowerDate) {
      const lastStr = new Date(user.lastHigherLowerDate).toISOString().split('T')[0];
      if (lastStr !== todayStr) {
        attemptsUsed = 0;
        isCompletedToday = false;
      }
    }

    const attemptsLeft = Math.max(0, MAX_DAILY_ATTEMPTS - attemptsUsed);

    if (isCompletedToday || attemptsLeft <= 0) {
      return NextResponse.json(
        safeJson({
          limitReached: true,
          attemptsLeft,
          isCompletedToday,
          message: isCompletedToday
            ? 'Вы уже забрали попкорн сегодня! Приходите завтра.'
            : 'Попытки на сегодня исчерпаны (5 из 5). Возвращайтесь завтра!',
        })
      );
    }

    // Раунд 1, 3, 5: Рейтинг TMDB. Раунд 2, 4: Год выхода.
    const questionType: 'rating' | 'year' = round % 2 === 1 ? 'rating' : 'year';

    const pool = await getTopMoviesPool();
    // Исключаем фильмы, которые уже участвовали в текущей сессии
    const availablePool = pool.filter((m) => !excludedIds.has(m.id));
    const activePool = availablePool.length >= 2 ? availablePool : pool;

    if (activePool.length < 2) {
      return NextResponse.json({ error: 'Не удалось загрузить фильмы' }, { status: 500 });
    }

    // Выбираем левый фильм
    const leftMovie = activePool[Math.floor(Math.random() * activePool.length)];
    const candidates = activePool.filter((m) => m.id !== leftMovie.id);

    let rightMovie: any = null;

    if (questionType === 'rating') {
      const leftVal = leftMovie.vote_average;

      // Градуировка разницы оценок по раундам
      // 1 раунд: разница >= 1.4
      // 3 раунд: разница от 0.45 до 0.9 (отсекаем микро-разницу 0.1!)
      // 5 раунд: разница от 0.2 до 0.4
      let minDiff = 0.2;
      let maxDiff = 0.45;

      if (round === 1) {
        minDiff = 1.3;
        maxDiff = 3.0;
      } else if (round === 3) {
        minDiff = 0.45;
        maxDiff = 0.95;
      }

      // Ищем фильм, попадающий в диапазон сложности
      const suited = candidates.filter((m) => {
        const diff = Math.abs(m.vote_average - leftVal);
        return diff >= minDiff && diff <= maxDiff;
      });

      if (suited.length > 0) {
        rightMovie = suited[Math.floor(Math.random() * suited.length)];
      } else {
        // Запасной выбор: сортируем и берем ближайший с разницей не менее minDiff
        candidates.sort((a, b) => Math.abs(a.vote_average - leftVal) - Math.abs(b.vote_average - leftVal));
        rightMovie = candidates.find((m) => Math.abs(m.vote_average - leftVal) >= 0.25) || candidates[0];
      }
    } else {
      const leftYear = parseInt(leftMovie.release_date.split('-')[0], 10);

      // Градуировка годов:
      // 2 раунд: разница >= 10 лет
      // 4 раунд: разница от 3 до 7 лет
      let minYearDiff = round === 2 ? 10 : 3;
      let maxYearDiff = round === 2 ? 30 : 8;

      const suited = candidates.filter((m) => {
        const y = parseInt(m.release_date.split('-')[0], 10);
        const diff = Math.abs(y - leftYear);
        return diff >= minYearDiff && diff <= maxYearDiff;
      });

      if (suited.length > 0) {
        rightMovie = suited[Math.floor(Math.random() * suited.length)];
      } else {
        rightMovie = candidates.find((m) => {
          const y = parseInt(m.release_date.split('-')[0], 10);
          return Math.abs(y - leftYear) >= 2;
        }) || candidates[0];
      }
    }

    const leftYear = leftMovie.release_date?.split('-')[0] || '';
    const rightYear = rightMovie.release_date?.split('-')[0] || '';

    return NextResponse.json(
      safeJson({
        limitReached: false,
        attemptsLeft,
        round,
        questionType,
        rewardForRound: ROUND_REWARDS[round - 1] || 1,
        leftMovie: {
          id: leftMovie.id,
          title: leftMovie.title,
          posterUrl: formatPosterUrl(leftMovie.poster_path),
          rating: Number(leftMovie.vote_average.toFixed(1)),
          year: leftYear,
        },
        rightMovie: {
          id: rightMovie.id,
          title: rightMovie.title,
          posterUrl: formatPosterUrl(rightMovie.poster_path),
          rating: Number(rightMovie.vote_average.toFixed(1)),
          year: rightYear,
        },
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
    const { action, currentBank } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let attemptsUsed = user.higherLowerAttempts || 0;
    let isCompleted = user.higherLowerCompleted || false;

    if (user.lastHigherLowerDate) {
      const lastStr = new Date(user.lastHigherLowerDate).toISOString().split('T')[0];
      if (lastStr !== todayStr) {
        attemptsUsed = 0;
        isCompleted = false;
      }
    }

    if (action === 'cashout') {
      const reward = Math.max(0, parseInt(currentBank || 0, 10));
      if (reward <= 0) {
        return NextResponse.json({ error: 'Нечего забирать' }, { status: 400 });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          popcorn: { increment: reward },
          lastHigherLowerDate: now,
          higherLowerCompleted: true,
        },
      });

      return NextResponse.json(
        safeJson({
          success: true,
          reward,
          popcorn: updated.popcorn,
        })
      );
    }

    if (action === 'fail-attempt') {
      const nextAttempts = attemptsUsed + 1;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          lastHigherLowerDate: now,
          higherLowerAttempts: nextAttempts,
        },
      });

      return NextResponse.json(
        safeJson({
          success: true,
          attemptsLeft: Math.max(0, MAX_DAILY_ATTEMPTS - nextAttempts),
        })
      );
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}