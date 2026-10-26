import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarizeProgress } from "@/lib/progress";
import {
  saveLibrary,
  saveProgress,
  mutationErrorResponse,
} from "@/lib/library-mutations";
import {
  getCurrentUserId,
  formatPosterUrl,
  safeJson,
} from "@/lib/current-user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return NextResponse.json(
        { error: "Некорректный ID тайтла" },
        { status: 400 },
      );
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 401 },
      );
    }

    // 1. Поиск тайтла в базе
    let targetShow = await prisma.show.findUnique({
      where: { id: numId },
      include: {
        episodes: {
          orderBy: [{ season: "asc" }, { episode: "asc" }],
        },
      },
    });

    if (!targetShow) {
      targetShow = await prisma.show.findFirst({
        where: { tmdbId: numId },
        include: {
          episodes: {
            orderBy: [{ season: "asc" }, { episode: "asc" }],
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
                orderBy: [{ season: "asc" }, { episode: "asc" }],
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
      return NextResponse.json({ error: "Тайтл не найден" }, { status: 404 });
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
          status: "watching",
        },
        include: {
          ratings: true,
          progress: true,
        },
      });
    }

    // 3. Автоматическая генерация серий из TMDB для сериалов
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      "";

    if (
      targetShow.kind === "series" &&
      (targetShow.episodes.length === 0 ||
        targetShow.episodes.length < userShow.totalEpisodes ||
        userShow.totalEpisodes <= 0) &&
      apiKey
    ) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (apiKey.startsWith("eyJ"))
          headers["Authorization"] = `Bearer ${apiKey}`;

        let tmdbId = targetShow.tmdbId;

        if (!tmdbId && targetShow.name) {
          let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(targetShow.name)}&language=ru-RU`;
          if (!apiKey.startsWith("eyJ")) searchUrl += `&api_key=${apiKey}`;

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
          if (!apiKey.startsWith("eyJ")) tmdbUrl += `&api_key=${apiKey}`;

          const tmdbRes = await fetch(tmdbUrl, { headers });
          if (tmdbRes.ok) {
            const data = await tmdbRes.json();
            const seasons = (data.seasons || []).filter(
              (s: { season_number: number; episode_count: number }) =>
                s.season_number > 0 && s.episode_count > 0,
            );

            const episodesToCreate: {
              showId: number;
              season: number;
              episode: number;
            }[] = [];
            let totalEpsCount = data.number_of_episodes || 0;

            if (seasons.length > 0) {
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
                  orderBy: [{ season: "asc" }, { episode: "asc" }],
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
        console.error("Ошибка подтягивания сезонов TMDB:", tmdbErr);
      }
    }

    // Если это фильм и серий нет — создаем 1 серию (сам фильм)
    if (targetShow.kind === "movie" && targetShow.episodes.length === 0) {
      await prisma.episode.upsert({
        where: {
          showId_season_episode: {
            showId: targetShow.id,
            season: 1,
            episode: 1,
          },
        },
        update: {},
        create: {
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

    // Synchronization can change totals and the revision used by quick-progress.
    userShow = await prisma.userShow.findUniqueOrThrow({
      where: { id: userShow.id },
      include: { ratings: true, progress: true },
    });

    // 4. Подсчет прогресса серий и извлечение таймкодов (stoppedAt)
    const episodes = targetShow.episodes || [];
    const progressMap = new Map<
      number,
      { watched: boolean; stoppedAt: string | null }
    >();
    for (const p of userShow.progress || []) {
      progressMap.set(p.episodeId, {
        watched: p.watched,
        stoppedAt: p.stoppedAt,
      });
    }

    const summary = summarizeProgress({ ...userShow, show: targetShow });
    const watchedEpisodesCount = summary.watched;
    const totalEpisodes = summary.total;
    const progressPercent = summary.percent ?? 0;

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
        const sWatchedCount = sEpisodes.filter(
          (e) => progressMap.get(e.id)?.watched,
        ).length;
        return {
          seasonNumber: sNum,
          totalEpisodes: sEpisodes.length,
          watchedEpisodes: sWatchedCount,
          isCompleted:
            sWatchedCount === sEpisodes.length && sEpisodes.length > 0,
          episodes: sEpisodes.map((e) => {
            const prog = progressMap.get(e.id);
            return {
              id: e.id,
              season: e.season,
              episode: e.episode,
              watched: prog ? prog.watched : false,
              stoppedAt: prog?.stoppedAt || null,
            };
          }),
        };
      });

    return NextResponse.json(
      safeJson({
        userShow: {
          id: userShow.id,
          updatedAt: userShow.updatedAt,
          showId: targetShow.id,
          status: userShow.status,
          kind: userShow.kind,
          isFavorite: userShow.isFavorite,
          isCompleted: userShow.isCompleted,
          dubbing: userShow.dubbing,
          watchSite: userShow.watchSite,
          userRating:
            userShow.ratings.find((rating) => rating.episodeId === null)
              ?.score ?? null,
        },
        show: {
          id: targetShow.id,
          name: targetShow.name,
          title: targetShow.name,
          originalName: targetShow.originalName,
          originalTitle: targetShow.originalName,
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
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(
      safeJson(
        await saveProgress(
          userId,
          Number((await params).id),
          await request.json().catch(() => null),
        ),
      ),
    );
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(
      safeJson({
        success: true,
        item: await saveLibrary(
          userId,
          Number((await params).id),
          await request.json().catch(() => null),
        ),
      }),
    );
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
