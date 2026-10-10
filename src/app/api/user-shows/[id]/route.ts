import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, formatPosterUrl, safeJson } from '@/lib/current-user';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Некорректный ID тайтла' }, { status: 400 });
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    // 1. Ищем тайтл в базе данных
    let targetShow = await prisma.show.findUnique({
      where: { id: numId },
      include: {
        episodes: {
          orderBy: [{ season: 'asc' }, { episode: 'asc' }],
        },
      },
    });

    if (!targetShow) {
      targetShow = await prisma.show.findFirst({
        where: { tmdbId: numId },
        include: {
          episodes: {
            orderBy: [{ season: 'asc' }, { episode: 'asc' }],
          },
        },
      });
    }

    if (!targetShow) {
      const us = await prisma.userShow.findUnique({
        where: { id: numId },
        include: {
          show: {
            include: {
              episodes: {
                orderBy: [{ season: 'asc' }, { episode: 'asc' }],
              },
            },
          },
        },
      });
      if (us?.show) {
        targetShow = us.show;
      }
    }

    if (!targetShow) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    // 2. Находим запись пользователя
    let userShow = await prisma.userShow.findUnique({
      where: {
        userId_showId: {
          userId: currentUserId,
          showId: targetShow.id,
        },
      },
      include: {
        ratings: true,
        progress: true,
      },
    });

    if (!userShow) {
      userShow = await prisma.userShow.create({
        data: {
          userId: currentUserId,
          showId: targetShow.id,
          kind: targetShow.kind,
          status: 'watching',
        },
        include: {
          ratings: true,
          progress: true,
        },
      });
    }

    // 3. АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ СЕРИЙ ИЗ TMDB ДЛЯ СЕРИАЛОВ
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (targetShow.kind === 'series' && (targetShow.episodes.length === 0 || userShow.totalEpisodes <= 0) && apiKey) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;

        let tmdbId = targetShow.tmdbId;

        // Если tmdbId не был сохранен — ищем в TMDB по имени
        if (!tmdbId && targetShow.name) {
          let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(targetShow.name)}&language=ru-RU`;
          if (!apiKey.startsWith('eyJ')) searchUrl += `&api_key=${apiKey}`;

          const searchRes = await fetch(searchUrl, { headers });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
              tmdbId = searchData.results[0].id;
              await prisma.show.update({
                where: { id: targetShow.id },
                data: { tmdbId },
              });
            }
          }
        }

        if (tmdbId) {
          let tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?language=ru-RU`;
          if (!apiKey.startsWith('eyJ')) tmdbUrl += `&api_key=${apiKey}`;

          const tmdbRes = await fetch(tmdbUrl, { headers });
          if (tmdbRes.ok) {
            const data = await tmdbRes.json();
            const seasons = (data.seasons || []).filter(
              (s: { season_number: number; episode_count: number }) =>
                s.season_number > 0 && s.episode_count > 0
            );

            const episodesToCreate: { showId: number; season: number; episode: number }[] = [];
            let totalEpsCount = data.number_of_episodes || 0;

            if (targetShow.episodes.length === 0) {
              for (const s of seasons) {
                for (let ep = 1; ep <= s.episode_count; ep++) {
                  episodesToCreate.push({
                    showId: targetShow.id,
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
                targetShow.episodes = await prisma.episode.findMany({
                  where: { showId: targetShow.id },
                  orderBy: [{ season: 'asc' }, { episode: 'asc' }],
                });
              }
            }

            if (totalEpsCount === 0) {
              totalEpsCount = targetShow.episodes.length;
            }

            await prisma.userShow.update({
              where: { id: userShow.id },
              data: {
                totalSeasons: seasons.length || 1,
                totalEpisodes: totalEpsCount,
              },
            });
            userShow.totalEpisodes = totalEpsCount;
            userShow.totalSeasons = seasons.length || 1;
          }
        }
      } catch (tmdbErr) {
        console.error('Ошибка подтягивания сезонов TMDB:', tmdbErr);
      }
    }

    // Если это фильм и серий нет — создаем 1 серию (сам фильм)
    if (targetShow.kind === 'movie' && targetShow.episodes.length === 0) {
      await prisma.episode.create({
        data: {
          showId: targetShow.id,
          season: 1,
          episode: 1,
        },
      });
      targetShow.episodes = await prisma.episode.findMany({
        where: { showId: targetShow.id },
      });
      await prisma.userShow.update({
        where: { id: userShow.id },
        data: { totalEpisodes: 1, totalSeasons: 1 },
      });
    }

    // 4. Подсчет прогресса серий
    const episodes = targetShow.episodes || [];
    const watchedEpisodeIds = new Set(
      (userShow.progress || []).filter((p) => p.watched).map((p) => p.episodeId)
    );

    const totalEpisodes =
      userShow.totalEpisodes > 0
        ? userShow.totalEpisodes
        : episodes.length > 0
        ? episodes.length
        : targetShow.kind === 'movie'
        ? 1
        : Math.max(1, watchedEpisodeIds.size);

    const watchedEpisodesCount = watchedEpisodeIds.size;
    const progressPercent =
      totalEpisodes > 0 ? Math.min(100, Math.round((watchedEpisodesCount / totalEpisodes) * 100)) : 0;

    // Группировка серий по сезонам
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

    return NextResponse.json(
      safeJson({
        userShow: {
          id: userShow.id,
          showId: targetShow.id,
          status: userShow.status,
          kind: userShow.kind,
          isFavorite: userShow.isFavorite,
          isCompleted: userShow.isCompleted,
          dubbing: userShow.dubbing,
          watchSite: userShow.watchSite,
          userRating: userShow.ratings?.[0]?.score || null,
        },
        show: {
          id: targetShow.id,
          name: targetShow.name,
          title: targetShow.name,
          originalName: targetShow.originalName,
          posterUrl: formatPosterUrl(targetShow.posterUrl),
          year: targetShow.year,
          kind: targetShow.kind,
          genres: targetShow.genres,
          tmdbRating: targetShow.tmdbRating,
        },
        stats: {
          totalEpisodes,
          watchedEpisodesCount,
          progressPercent,
        },
        seasons: seasonsList,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { episodeId, seasonNumber, markSeasonWatched, watched = true } = body;

    let targetShow = await prisma.show.findUnique({
      where: { id: numId },
      include: { episodes: true },
    });

    if (!targetShow) {
      targetShow = await prisma.show.findFirst({
        where: { tmdbId: numId },
        include: { episodes: true },
      });
    }

    if (!targetShow) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId: currentUserId,
          showId: targetShow.id,
        },
      },
      update: {},
      create: {
        userId: currentUserId,
        showId: targetShow.id,
        kind: targetShow.kind,
        status: 'watching',
      },
    });

    if (markSeasonWatched !== undefined && seasonNumber !== undefined) {
      const seasonEpisodes = targetShow.episodes.filter(
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

      return NextResponse.json(safeJson({ success: true, updatedSeason: seasonNumber }));
    }

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

      return NextResponse.json(safeJson({ success: true, progress: epProgress }));
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let targetShow = await prisma.show.findUnique({
      where: { id: numId },
    });

    if (!targetShow) {
      targetShow = await prisma.show.findFirst({
        where: { tmdbId: numId },
      });
    }

    if (!targetShow) {
      return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
    }

    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId: currentUserId,
          showId: targetShow.id,
        },
      },
      update: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.dubbing !== undefined ? { dubbing: body.dubbing } : {}),
        ...(body.watchSite !== undefined ? { watchSite: body.watchSite } : {}),
        ...(body.isFavorite !== undefined ? { isFavorite: Boolean(body.isFavorite) } : {}),
        ...(body.status === 'completed' ? { isCompleted: true } : {}),
      },
      create: {
        userId: currentUserId,
        showId: targetShow.id,
        kind: targetShow.kind,
        status: body.status || 'watching',
        dubbing: body.dubbing || null,
        watchSite: body.watchSite || null,
        isFavorite: body.isFavorite !== undefined ? Boolean(body.isFavorite) : false,
        isCompleted: body.status === 'completed',
      },
    });

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

    return NextResponse.json(safeJson({ success: true, item: userShow }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}