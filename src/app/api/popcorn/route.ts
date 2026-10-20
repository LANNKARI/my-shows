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

// Хелпер для запросов к TMDB
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

    // Проверяем возможность забрать ежедневный бонус
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
          // Пропустил день - сброс серии
          nextStreak = 1;
        }
      }
    } else {
      nextStreak = 1;
    }

    // Проверяем попытки в викторине
    let quizAttempts = user.quizAttemptsToday || 0;
    if (user.lastQuizDate) {
      const lastQuizStr = new Date(user.lastQuizDate).toISOString().split('T')[0];
      if (lastQuizStr !== todayStr) {
        quizAttempts = 0; // Новый день — сброс попыток
      }
    }

    // Запрос вопроса для квиза
    if (action === 'get-quiz') {
      if (quizAttempts >= 10) {
        return NextResponse.json({
          limitReached: true,
          message: 'На сегодня лимит исчерпан! Возвращайтесь завтра.',
          attemptsLeft: 0,
        });
      }

      // Берём случайную страницу популярных фильмов
      const randomPage = Math.floor(Math.random() * 8) + 1;
      const data = await fetchTmdb('movie/popular', { page: randomPage });
      const movies = (data?.results || []).filter((m: any) => m.backdrop_path && m.title);

      if (movies.length < 4) {
        return NextResponse.json({ error: 'Ошибка подбора фильмов' }, { status: 500 });
      }

      // Перемешиваем
      const shuffled = movies.sort(() => 0.5 - Math.random());
      const targetMovie = shuffled[0];
      const distractors = shuffled.slice(1, 4);

      // 4 варианта ответа
      const options = [targetMovie.title, ...distractors.map((d: any) => d.title)].sort(
        () => 0.5 - Math.random()
      );

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

    // Общая информация о балансе и наградах
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

    // 1. Получение ежедневного бонуса
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
        if (diffDays > 1) {
          streak = 1;
        }
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

    // 2. Проверка ответа викторины
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

      // Проверяем фильм по API TMDB
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