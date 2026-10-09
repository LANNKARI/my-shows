import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { translateGenres } from '@/lib/genres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing show id' }, { status: 400 });
    }

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Определяем текущего пользователя (если авторизован)
    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    // 1. Поиск в Show по id или tmdbId
    let show = await prisma.show.findFirst({
      where: {
        OR: [{ id: numId }, { tmdbId: numId }],
      },
      include: {
        episodes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 2. Если не найден в Show — проверяем, не был ли передан UserShow.id
    if (!show) {
      const userShowItem = await prisma.userShow.findUnique({
        where: { id: numId },
        include: {
          show: {
            include: {
              episodes: true,
              comments: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, avatarUrl: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });
      if (userShowItem?.show) {
        show = userShowItem.show;
      }
    }

    // 3. Если не найден — проверяем старую таблицу Title (карточки до миграции)
    if (!show) {
      const oldTitle = await prisma.title.findUnique({
        where: { id: numId },
      });

      if (oldTitle) {
        // Ищем соответствие по имени в каталоге Show
        show = await prisma.show.findFirst({
          where: { name: oldTitle.name },
          include: {
            episodes: true,
            comments: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, avatarUrl: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        // Если канонического Show еще нет — создаем его на основе старого Title
        if (!show) {
          show = await prisma.show.create({
            data: {
              name: oldTitle.name,
              originalName: oldTitle.originalName,
              posterUrl: oldTitle.posterUrl,
              kind: oldTitle.kind || 'series',
              genres: [],
            },
            include: {
              episodes: true,
              comments: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, avatarUrl: true },
                  },
                },
              },
            },
          });
        }
      }
    }

    // 4. Если в базе совсем ничего нет — проверяем напрямую через TMDB
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (!show && apiKey) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const buildUrl = (type: 'movie' | 'tv') => {
        let u = `https://api.themoviedb.org/3/${type}/${numId}?language=ru-RU&append_to_response=credits`;
        if (!apiKey.startsWith('eyJ')) u += `&api_key=${apiKey}`;
        return u;
      };

      let tmdbRes = await fetch(buildUrl('movie'), { headers });
      let mediaKind: 'movie' | 'series' = 'movie';

      if (!tmdbRes.ok) {
        tmdbRes = await fetch(buildUrl('tv'), { headers });
        mediaKind = 'series';
      }

      if (tmdbRes.ok) {
        const data = await tmdbRes.json();
        const name = data.title || data.name || 'Без названия';
        const originalName = data.original_title || data.original_name || null;
        const description = data.overview || '';
        const releaseDate = data.release_date || data.first_air_date || null;
        const year = releaseDate ? releaseDate.slice(0, 4) : null;
        const posterUrl = data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : null;
        const tmdbRating = data.vote_average ? Math.round(data.vote_average * 10) / 10 : 0;
        const tmdbVotes = data.vote_count || 0;

        const runtime = data.runtime || data.episode_run_time?.[0] || null;
        const budget = data.budget && data.budget > 0 ? BigInt(data.budget) : null;
        const revenue = data.revenue && data.revenue > 0 ? BigInt(data.revenue) : null;

        const countries = (data.production_countries || []).map((c: { name: string }) => c.name);
        const studios = (data.production_companies || []).map((c: { name: string }) => c.name);

        const rawGenreNames = (data.genres || []).map((g: { name: string }) => g.name);
        const translatedGenres: string[] = translateGenres(rawGenreNames);

        const director =
          data.credits?.crew?.find((c: { job: string; name: string }) => c.job === 'Director')?.name ||
          data.created_by?.[0]?.name ||
          null;

        const creators = (data.created_by || []).map((c: { name: string }) => c.name);

        // Формируем список топ-20 актеров
        const cast = (data.credits?.cast || []).slice(0, 20).map((a: { id: number; name: string; character?: string; profile_path?: string | null }) => ({
          id: a.id,
          name: a.name,
          character: a.character || '',
          profileUrl: a.profile_path ? `https://image.tmdb.org/t/p/w185${a.profile_path}` : null,
          profile_path: a.profile_path,
        }));

        show = await prisma.show.create({
          data: {
            tmdbId: numId,
            name,
            originalName,
            description,
            kind: mediaKind,
            posterUrl,
            year,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            runtime,
            budget,
            revenue,
            countries,
            studios,
            genres: translatedGenres,
            director,
            creators,
            cast,
            tmdbRating,
            tmdbVotes,
          },
          include: {
            episodes: true,
            comments: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, avatarUrl: true },
                },
              },
            },
          },
        });
      }
    }

    if (!show) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    // 5. Если фильм в базе есть, но актёры/бюджет ещё не были подтянуты — догружаем из TMDB
    if (show.tmdbId && (!show.cast || (Array.isArray(show.cast) && show.cast.length === 0) || !show.director) && apiKey) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
        const type = show.kind === 'series' ? 'tv' : 'movie';
        let detailUrl = `https://api.themoviedb.org/3/${type}/${show.tmdbId}?language=ru-RU&append_to_response=credits`;
        if (!apiKey.startsWith('eyJ')) detailUrl += `&api_key=${apiKey}`;

        const detailRes = await fetch(detailUrl, { headers });
        if (detailRes.ok) {
          const d = await detailRes.json();
          const cast = (d.credits?.cast || []).slice(0, 20).map((a: { id: number; name: string; character?: string; profile_path?: string | null }) => ({
            id: a.id,
            name: a.name,
            character: a.character || '',
            profileUrl: a.profile_path ? `https://image.tmdb.org/t/p/w185${a.profile_path}` : null,
            profile_path: a.profile_path,
          }));

          const director =
            d.credits?.crew?.find((c: { job: string; name: string }) => c.job === 'Director')?.name ||
            d.created_by?.[0]?.name ||
            null;

          const runtime = d.runtime || d.episode_run_time?.[0] || show.runtime;
          const budget = d.budget && d.budget > 0 ? BigInt(d.budget) : show.budget;
          const revenue = d.revenue && d.revenue > 0 ? BigInt(d.revenue) : show.revenue;
          const countries = (d.production_countries || []).map((c: { name: string }) => c.name);
          const studios = (d.production_companies || []).map((c: { name: string }) => c.name);

          show = await prisma.show.update({
            where: { id: show.id },
            data: {
              cast,
              director,
              runtime,
              budget,
              revenue,
              countries: countries.length > 0 ? countries : show.countries,
              studios: studios.length > 0 ? studios : show.studios,
            },
            include: {
              episodes: true,
              comments: {
                include: {
                  user: {
                    select: { id: true, name: true, username: true, avatarUrl: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          });
        }
      } catch {
        // Оставляем текущую запись при сбое сети TMDB
      }
    }

    // 6. Получаем статус просмотра текущего пользователя в его библиотеке
    let userShow = null;
    if (currentUserId) {
      userShow = await prisma.userShow.findUnique({
        where: {
          userId_showId: {
            userId: currentUserId,
            showId: show.id,
          },
        },
        include: {
          ratings: true,
          progress: true,
        },
      });
    }

    // Безопасная сериализация BigInt для JSON
    const serializedShow = {
      ...show,
      title: show.name,
      originalTitle: show.originalName,
      budget: show.budget ? Number(show.budget) : null,
      revenue: show.revenue ? Number(show.revenue) : null,
    };

    return NextResponse.json({
      show: serializedShow,
      userShow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch show', details: message },
      { status: 500 }
    );
  }
}