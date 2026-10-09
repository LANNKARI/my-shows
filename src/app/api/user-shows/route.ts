import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, formatPosterUrl } from '@/lib/current-user';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'watching';

    // 1. Загружаем записи пользователя со строгой фильтрацией по статусу
    const userShows = await prisma.userShow.findMany({
      where: {
        userId: currentUserId,
        ...(statusParam === 'all'
          ? { status: { not: 'dropped' } }
          : { status: statusParam }),
      },
      include: {
        show: {
          include: { episodes: true },
        },
        ratings: true,
        progress: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. Если список пуст и запрошен watching — синхронизируем активные тайтлы из Title
    if (userShows.length === 0 && statusParam === 'watching') {
      const oldTitles = await prisma.title.findMany({
        where: { isCompleted: false },
        take: 20,
      });

      for (const t of oldTitles) {
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

        const created = await prisma.userShow.upsert({
          where: {
            userId_showId: {
              userId: currentUserId,
              showId: s.id,
            },
          },
          update: { status: 'watching' },
          create: {
            userId: currentUserId,
            showId: s.id,
            kind: t.kind || 'series',
            status: 'watching',
            totalSeasons: t.totalSeasons,
            totalEpisodes: t.totalEpisodes,
          },
          include: {
            show: { include: { episodes: true } },
            ratings: true,
            progress: true,
          },
        });
        userShows.push(created);
      }
    }

    const normalized = userShows.map((us) => ({
      id: us.showId,
      userShowId: us.id,
      showId: us.showId,
      name: us.show?.name || 'Без названия',
      title: us.show?.name || 'Без названия',
      originalName: us.show?.originalName,
      originalTitle: us.show?.originalName,
      posterUrl: formatPosterUrl(us.show?.posterUrl),
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
        posterUrl: formatPosterUrl(us.show?.posterUrl),
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
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        status,
        isCompleted: status === 'completed',
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
      showId: targetShow.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}