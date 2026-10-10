import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, formatPosterUrl, safeJson } from '@/lib/current-user';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'watching';

    // 1. Загружаем сериалы и фильмы пользователя
    let userShows = await prisma.userShow.findMany({
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

    // 2. Если на главной пусто — синхронизируем тайтлы из Title
    if (userShows.length === 0 && statusParam === 'watching') {
      const anyUserShows = await prisma.userShow.findMany({
        where: { status: 'watching' },
        include: { show: { include: { episodes: true } }, ratings: true, progress: true },
      });

      if (anyUserShows.length > 0) {
        await prisma.userShow.updateMany({
          where: { id: { in: anyUserShows.map((w) => w.id) } },
          data: { userId: currentUserId },
        });
        userShows = anyUserShows;
      } else {
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
    }

    // 3. АВТО-ПОДТЯГИВАНИЕ ОБЩЕГО КОЛИЧЕСТВА СЕРИЙ ИЗ TMDB
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (apiKey) {
      for (const us of userShows) {
        const isSeries = us.kind === 'series' || us.show?.kind === 'series';

        // Если это сериал и количество серий равно 0 или список серий пуст
        if (isSeries && (us.totalEpisodes <= 0 || (us.show?.episodes?.length || 0) === 0)) {
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;

            let tmdbId = us.show?.tmdbId;

            // Если tmdbId ещё не был сохранён — ищем сериал в TMDB по названию
            if (!tmdbId && us.show?.name) {
              let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(us.show.name)}&language=ru-RU`;
              if (!apiKey.startsWith('eyJ')) searchUrl += `&api_key=${apiKey}`;

              const searchRes = await fetch(searchUrl, { headers });
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.results && searchData.results.length > 0) {
                  tmdbId = searchData.results[0].id;
                  await prisma.show.update({
                    where: { id: us.show.id },
                    data: { tmdbId },
                  });
                }
              }
            }

            // Запрашиваем детали сериала из TMDB
            if (tmdbId) {
              let detailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?language=ru-RU`;
              if (!apiKey.startsWith('eyJ')) detailsUrl += `&api_key=${apiKey}`;

              const tvRes = await fetch(detailsUrl, { headers });
              if (tvRes.ok) {
                const tvData = await tvRes.json();
                const totalEpisodesCount = tvData.number_of_episodes || 0;
                const totalSeasonsCount = tvData.number_of_seasons || 1;

                if (totalEpisodesCount > 0) {
                  await prisma.userShow.update({
                    where: { id: us.id },
                    data: {
                      totalEpisodes: totalEpisodesCount,
                      totalSeasons: totalSeasonsCount,
                    },
                  });
                  us.totalEpisodes = totalEpisodesCount;
                  us.totalSeasons = totalSeasonsCount;
                }

                // Генерируем эпизоды в базе, если их ещё нет
                if (us.show.episodes.length === 0 && Array.isArray(tvData.seasons)) {
                  const episodesToCreate: { showId: number; season: number; episode: number }[] = [];
                  for (const s of tvData.seasons) {
                    if (s.season_number > 0 && s.episode_count > 0) {
                      for (let ep = 1; ep <= s.episode_count; ep++) {
                        episodesToCreate.push({
                          showId: us.show.id,
                          season: s.season_number,
                          episode: ep,
                        });
                      }
                    }
                  }

                  if (episodesToCreate.length > 0) {
                    await prisma.episode.createMany({
                      data: episodesToCreate,
                      skipDuplicates: true,
                    });

                    us.show.episodes = await prisma.episode.findMany({
                      where: { showId: us.show.id },
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Ошибка синхронизации серий с TMDB:', e);
          }
        }
      }
    }

    // 4. Формирование ответа для фронтенда
    const normalized = userShows.map((us) => {
      const isMovie = us.kind === 'movie' || us.show?.kind === 'movie';
      const watchedCount = (us.progress || []).filter((p) => p.watched).length;

      // Рассчитываем точное количество серий
      let totalEpisodes = us.totalEpisodes > 0 ? us.totalEpisodes : us.show?.episodes?.length || 0;
      if (isMovie && totalEpisodes <= 0) {
        totalEpisodes = 1;
      }
      if (watchedCount > totalEpisodes && totalEpisodes > 0) {
        totalEpisodes = watchedCount;
      }

      return {
        id: us.showId,
        userShowId: us.id,
        showId: us.showId,
        name: us.show?.name || 'Без названия',
        title: us.show?.name || 'Без названия',
        originalName: us.show?.originalName,
        originalTitle: us.show?.originalName,
        posterUrl: formatPosterUrl(us.show?.posterUrl),
        year: us.show?.year || (us.show?.releaseDate ? new Date(us.show.releaseDate).getFullYear().toString() : ''),
        kind: isMovie ? 'movie' : 'series',
        status: us.status || 'watching',
        isCompleted: us.isCompleted,
        isFavorite: us.isFavorite,
        totalSeasons: us.totalSeasons || 1,
        totalEpisodes,
        dubbing: us.dubbing,
        watchSite: us.watchSite,
        rating: us.ratings?.[0]?.score || (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
        tmdbRating: us.show?.tmdbRating,
        show: {
          id: us.show?.id,
          name: us.show?.name,
          title: us.show?.name,
          originalName: us.show?.originalName,
          posterUrl: formatPosterUrl(us.show?.posterUrl),
          kind: us.show?.kind,
          episodes: us.show?.episodes || [],
        },
        progress: us.progress || [],
        ratings: us.ratings || [],
        updatedAt: us.updatedAt,
        createdAt: us.createdAt,
      };
    });

    return NextResponse.json(safeJson(normalized));
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

    let targetShow = await prisma.show.findUnique({
      where: { id: numShowId },
      include: { episodes: true },
    });

    if (!targetShow) {
      targetShow = await prisma.show.findFirst({
        where: { tmdbId: numShowId },
        include: { episodes: true },
      });
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
        totalEpisodes: targetShow.episodes.length || 0,
      },
      include: {
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

    return NextResponse.json(
      safeJson({
        success: true,
        item: {
          ...userShow,
          showId: targetShow.id,
        },
        showId: targetShow.id,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}