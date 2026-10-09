import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Получение детальной информации для трекера серий
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Некорректный ID' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    // 1. Ищем запись по UserShow.id или по Show.id
    let userShow = await prisma.userShow.findFirst({
      where: {
        userId: currentUserId,
        OR: [{ id: numId }, { showId: numId }],
      },
      include: {
        show: {
          include: {
            episodes: {
              orderBy: [{ season: 'asc' }, { episode: 'asc' }],
            },
          },
        },
        progress: true,
        ratings: true,
      },
    });

    // 2. Если записи UserShow ещё нет, но Show существует — создаем
    if (!userShow) {
      const targetShow = await prisma.show.findUnique({
        where: { id: numId },
        include: {
          episodes: {
            orderBy: [{ season: 'asc' }, { episode: 'asc' }],
          },
        },
      });

      if (targetShow) {
        userShow = await prisma.userShow.create({
          data: {
            userId: currentUserId,
            showId: targetShow.id,
            kind: targetShow.kind,
            status: 'watching',
          },
          include: {
            show: {
              include: {
                episodes: {
                  orderBy: [{ season: 'asc' }, { episode: 'asc' }],
                },
              },
            },
            progress: true,
            ratings: true,
          },
        });
      }
    }

    if (!userShow) {
      return NextResponse.json({ error: 'Запись трекера не найдена' }, { status: 404 });
    }

    const show = userShow.show;

    // 3. АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ СЕРИЙ И СЕЗОНОВ ИЗ TMDB
    // Если это сериал и в базе пока 0 серий
    if (show.kind === 'series' && show.episodes.length === 0 && show.tmdbId) {
      const apiKey =
        process.env.TMDB_API_KEY ||
        process.env.TMDB_READ_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_TMDB_API_KEY ||
        '';

      if (apiKey) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
          let tmdbUrl = `https://api.themoviedb.org/3/tv/${show.tmdbId}?language=ru-RU`;
          if (!apiKey.startsWith('eyJ')) tmdbUrl += `&api_key=${apiKey}`;

          const tmdbRes = await fetch(tmdbUrl, { headers });
          if (tmdbRes.ok) {
            const data = await tmdbRes.json();
            const seasons = (data.seasons || []).filter(
              (s: { season_number: number; episode_count: number }) =>
                s.season_number > 0 && s.episode_count > 0
            );

            const episodesToCreate: { showId: number; season: number; episode: number }[] = [];
            let totalEpsCount = 0;

            for (const s of seasons) {
              totalEpsCount += s.episode_count;
              for (let ep = 1; ep <= s.episode_count; ep++) {
                episodesToCreate.push({
                  showId: show.id,
                  season: s.season_number,
                  episode: ep,
                });
              }
            }

            if (episodesToCreate.length > 0) {
              await prisma.episode.createMany({
                data: episodesToCreate,
                skipDuplicates: true,
              });

              await prisma.userShow.update({
                where: { id: userShow.id },
                data: {
                  totalSeasons: seasons.length || 1,
                  totalEpisodes: totalEpsCount,
                },
              });

              // Перезагружаем серии из базы
              const createdEpisodes = await prisma.episode.findMany({
                where: { showId: show.id },
                orderBy: [{ season: 'asc' }, { episode: 'asc' }],
              });
              userShow.show.episodes = createdEpisodes;
            }
          }
        } catch (tmdbErr) {
          console.error('Ошибка подтягивания сезонов TMDB:', tmdbErr);
        }
      }
    }

    // Если это фильм и серий нет — создаем 1 серию (сам фильм)
    if (show.kind === 'movie' && show.episodes.length === 0) {
      await prisma.episode.create({
        data: {
          showId: show.id,
          season: 1,
          episode: 1,
        },
      });
      userShow.show.episodes = await prisma.episode.findMany({
        where: { showId: show.id },
      });
    }

    // 4. Расчет прогресса просмотра
    const episodes = userShow.show.episodes || [];
    const watchedEpisodeIds = new Set(
      (userShow.progress || []).filter((p) => p.watched).map((p) => p.episodeId)
    );

    const totalEpisodes = episodes.length;
    const watchedEpisodesCount = watchedEpisodeIds.size;
    const progressPercent =
      totalEpisodes > 0 ? Math.round((watchedEpisodesCount / totalEpisodes) * 100) : 0;

    // Группировка по сезонам
    const seasonsMap: Record<number, typeof episodes> = {};
    for (const ep of episodes) {
      if (!seasonsMap[ep.season]) seasonsMap[ep.season] = [];
      seasonsMap[ep.season].push(ep);
    }

    const seasonsList = Object.keys(seasonsMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((sNum) => {
        const sEpisodes = seasonsMap[sNum];
        const sWatchedCount = sEpisodes.filter((e) => watchedEpisodeIds.has(e.id)).length;
        return {
          seasonNumber: sNum,
          totalEpisodes: sEpisodes.length,
          watchedEpisodes: sWatchedCount,
          isCompleted: sWatchedCount === sEpisodes.length && sEpisodes.length > 0,
          episodes: sEpisodes.map((e) => ({
            id: e.id,
            season: e.season,
            episode: e.episode,
            watched: watchedEpisodeIds.has(e.id),
          })),
        };
      });

    return NextResponse.json({
      userShow: {
        id: userShow.id,
        showId: userShow.showId,
        status: userShow.status,
        kind: userShow.kind,
        isFavorite: userShow.isFavorite,
        isCompleted: userShow.isCompleted,
        dubbing: userShow.dubbing,
        watchSite: userShow.watchSite,
        userRating: userShow.ratings?.[0]?.score || null,
      },
      show: {
        id: show.id,
        name: show.name,
        title: show.name,
        originalName: show.originalName,
        posterUrl: show.posterUrl
          ? show.posterUrl.startsWith('http')
            ? show.posterUrl
            : `https://image.tmdb.org/t/p/w500${show.posterUrl.startsWith('/') ? '' : '/'}${show.posterUrl}`
          : null,
        year: show.year,
        kind: show.kind,
        genres: show.genres,
        tmdbRating: show.tmdbRating,
      },
      stats: {
        totalEpisodes,
        watchedEpisodesCount,
        progressPercent,
      },
      seasons: seasonsList,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Отметка серии или целого сезона как просмотренных
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { episodeId, seasonNumber, markSeasonWatched, watched = true } = body;

    const userShow = await prisma.userShow.findFirst({
      where: {
        userId: currentUserId,
        OR: [{ id: numId }, { showId: numId }],
      },
      include: { show: { include: { episodes: true } } },
    });

    if (!userShow) {
      return NextResponse.json({ error: 'UserShow not found' }, { status: 404 });
    }

    // 1. Отметка целого сезона
    if (markSeasonWatched !== undefined && seasonNumber !== undefined) {
      const seasonEpisodes = userShow.show.episodes.filter(
        (e) => e.season === Number(seasonNumber)
      );

      for (const ep of seasonEpisodes) {
        await prisma.episodeProgress.upsert({
          where: {
            userShowId_episodeId: {
              userShowId: userShow.id,
              episodeId: ep.id,
            },
          },
          update: { watched: Boolean(markSeasonWatched) },
          create: {
            userShowId: userShow.id,
            episodeId: ep.id,
            watched: Boolean(markSeasonWatched),
          },
        });
      }

      return NextResponse.json({ success: true, updatedSeason: seasonNumber });
    }

    // 2. Отметка одной конкретной серии
    if (episodeId) {
      const epProgress = await prisma.episodeProgress.upsert({
        where: {
          userShowId_episodeId: {
            userShowId: userShow.id,
            episodeId: Number(episodeId),
          },
        },
        update: { watched: Boolean(watched) },
        create: {
          userShowId: userShow.id,
          episodeId: Number(episodeId),
          watched: Boolean(watched),
        },
      });

      return NextResponse.json({ success: true, progress: epProgress });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Обновление заметок (озвучка, сайт, статус, личная оценка)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userShow = await prisma.userShow.findFirst({
      where: {
        userId: currentUserId,
        OR: [{ id: numId }, { showId: numId }],
      },
    });

    if (!userShow) {
      return NextResponse.json({ error: 'UserShow not found' }, { status: 404 });
    }

    const updated = await prisma.userShow.update({
      where: { id: userShow.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.dubbing !== undefined ? { dubbing: body.dubbing } : {}),
        ...(body.watchSite !== undefined ? { watchSite: body.watchSite } : {}),
        ...(body.status === 'completed' ? { isCompleted: true } : {}),
      },
    });

    // Оценка
    if (body.score !== undefined) {
      const score = Number(body.score);
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

    return NextResponse.json({ success: true, item: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}