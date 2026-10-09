import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    // Если сессия не определена, берем первого пользователя системы (для персонального трекера)
    if (!currentUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      currentUserId = firstUser?.id;
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    // 1. Загружаем записи из UserShow
    const userShows = currentUserId
      ? await prisma.userShow.findMany({
          where: {
            userId: currentUserId,
            ...(statusParam && statusParam !== 'all' ? { status: statusParam } : {}),
          },
          include: {
            show: {
              include: { episodes: true },
            },
            ratings: true,
            progress: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    // 2. Загружаем исторические записи из таблицы Title (включая созданные до миграции пользователей)
    const oldTitles = await prisma.title.findMany({
      where: currentUserId
        ? { OR: [{ userId: currentUserId }, { userId: null }] }
        : undefined,
      include: {
        episodes: true,
        ratings: true,
      },
    });

    // Автоматическая синхронизация Title -> UserShow
    if (oldTitles.length > 0 && currentUserId) {
      for (const t of oldTitles) {
        const alreadyExists = userShows.some(
          (us) => us.show?.name.toLowerCase() === t.name.toLowerCase()
        );

        if (!alreadyExists) {
          let s = await prisma.show.findFirst({ where: { name: t.name } });
          if (!s) {
            s = await prisma.show.create({
              data: {
                name: t.name,
                originalName: t.originalName,
                posterUrl: t.posterUrl,
                kind: t.kind || 'series',
                genres: [],
              },
            });
          }

          const defaultStatus = t.isCompleted ? 'completed' : 'watching';

          if (!statusParam || statusParam === 'all' || statusParam === defaultStatus) {
            const newUs = await prisma.userShow.upsert({
              where: {
                userId_showId: {
                  userId: currentUserId,
                  showId: s.id,
                },
              },
              update: {},
              create: {
                userId: currentUserId,
                showId: s.id,
                kind: t.kind || 'series',
                status: defaultStatus,
                isCompleted: t.isCompleted,
                isFavorite: t.isFavorite,
                totalSeasons: t.totalSeasons,
                totalEpisodes: t.totalEpisodes,
                dubbing: t.dubbing,
                watchSite: t.watchSite,
              },
              include: {
                show: { include: { episodes: true } },
                ratings: true,
                progress: true,
              },
            });

            userShows.push(newUs);
          }
        }
      }
    }

    // 3. Формируем универсальный массив для карточек интерфейса
    const normalized = userShows.map((us) => ({
      id: us.id,
      userShowId: us.id,
      showId: us.showId,
      name: us.show?.name || 'Без названия',
      title: us.show?.name || 'Без названия',
      originalName: us.show?.originalName,
      originalTitle: us.show?.originalName,
      posterUrl: us.show?.posterUrl,
      year: us.show?.year || (us.show?.releaseDate ? new Date(us.show.releaseDate).getFullYear().toString() : ''),
      kind: us.kind || us.show?.kind || 'series',
      status: us.status || 'watching',
      isCompleted: us.isCompleted,
      isFavorite: us.isFavorite,
      totalSeasons: us.totalSeasons,
      totalEpisodes: us.totalEpisodes,
      dubbing: us.dubbing,
      watchSite: us.watchSite,
      rating: us.ratings?.[0]?.score || (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      tmdbRating: us.show?.tmdbRating,
      show: {
        ...us.show,
        title: us.show?.name,
        originalTitle: us.show?.originalName,
      },
      progress: us.progress || [],
      ratings: us.ratings || [],
      updatedAt: us.updatedAt,
      createdAt: us.createdAt,
    }));

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    if (!currentUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      currentUserId = firstUser?.id;
    }

    if (!currentUserId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    const body = await request.json();
    const rawShowId = body.showId ?? body.tmdbId;

    if (!rawShowId) {
      return NextResponse.json({ error: 'Missing showId' }, { status: 400 });
    }

    const numShowId = Number(rawShowId);

    let targetShow = await prisma.show.findFirst({
      where: {
        OR: [
          { id: isNaN(numShowId) ? undefined : numShowId },
          { tmdbId: isNaN(numShowId) ? undefined : numShowId },
        ],
      },
    });

    if (!targetShow && !isNaN(numShowId)) {
      const oldTitle = await prisma.title.findUnique({ where: { id: numShowId } });
      if (oldTitle) {
        targetShow = await prisma.show.create({
          data: {
            name: oldTitle.name,
            originalName: oldTitle.originalName,
            posterUrl: oldTitle.posterUrl,
            kind: oldTitle.kind || 'series',
            genres: [],
          },
        });
      }
    }

    if (!targetShow && !isNaN(numShowId)) {
      const apiKey =
        process.env.TMDB_API_KEY ||
        process.env.TMDB_READ_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_TMDB_API_KEY ||
        '';

      if (apiKey) {
        const mediaType = body.kind === 'movie' ? 'movie' : 'tv';
        let u = `https://api.themoviedb.org/3/${mediaType}/${numShowId}?language=ru-RU`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
        else u += `&api_key=${apiKey}`;

        const resTmdb = await fetch(u, { headers });
        if (resTmdb.ok) {
          const d = await resTmdb.json();
          targetShow = await prisma.show.create({
            data: {
              tmdbId: numShowId,
              name: d.title || d.name || 'Без названия',
              originalName: d.original_title || d.original_name || null,
              description: d.overview || '',
              kind: mediaType === 'tv' ? 'series' : 'movie',
              posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
              genres: [],
            },
          });
        }
      }
    }

    if (!targetShow) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    const status = body.status || 'watching';

    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId: currentUserId,
          showId: targetShow.id,
        },
      },
      update: {
        ...(body.status ? { status } : {}),
        ...(status === 'completed' ? { isCompleted: true } : {}),
        ...(body.isCompleted !== undefined ? { isCompleted: Boolean(body.isCompleted) } : {}),
        ...(body.isFavorite !== undefined ? { isFavorite: Boolean(body.isFavorite) } : {}),
      },
      create: {
        userId: currentUserId,
        showId: targetShow.id,
        kind: targetShow.kind || 'series',
        status,
        isCompleted: status === 'completed',
        isFavorite: Boolean(body.isFavorite),
      },
      include: {
        show: true,
        ratings: true,
        progress: true,
      },
    });

    if (body.score !== undefined && body.score !== null) {
      const score = Math.min(Math.max(Number(body.score), 1), 10);
      const existingRating = await prisma.rating.findFirst({
        where: { userShowId: userShow.id, episodeId: null },
      });

      if (existingRating) {
        await prisma.rating.update({
          where: { id: existingRating.id },
          data: { score },
        });
      } else {
        await prisma.rating.create({
          data: {
            userShowId: userShow.id,
            score,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      item: userShow,
      userShow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}