import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarizeProgress } from "@/lib/progress";
import { LIBRARY_STATUSES } from "@/lib/library-validation";
import { saveLibrary, mutationErrorResponse } from "@/lib/library-mutations";
import {
  getCurrentUserId,
  formatPosterUrl,
  safeJson,
} from "@/lib/current-user";

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "watching";
    if (![...LIBRARY_STATUSES, "all", "library"].includes(statusParam)) {
      return NextResponse.json(
        { error: "Некорректный статус просмотра" },
        { status: 400 },
      );
    }

    const userShows = await prisma.userShow.findMany({
      where: {
        userId: currentUserId,
        ...(statusParam === "library"
          ? {}
          : statusParam === "all"
            ? { status: { not: "dropped" } }
            : { status: statusParam }),
      },
      include: {
        show: {
          include: {
            episodes: {
              orderBy: [{ season: "asc" }, { episode: "asc" }, { id: "asc" }],
            },
          },
        },
        ratings: true,
        progress: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      "";

    if (apiKey && statusParam !== "library") {
      for (const us of userShows) {
        const isSeries = us.kind === "series" || us.show?.kind === "series";

        if (
          isSeries &&
          (us.totalEpisodes <= 0 || (us.show?.episodes?.length || 0) === 0)
        ) {
          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (apiKey.startsWith("eyJ"))
              headers["Authorization"] = `Bearer ${apiKey}`;

            let tmdbId = us.show?.tmdbId;

            if (!tmdbId && us.show?.name) {
              let searchUrl = `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(us.show.name)}&language=ru-RU`;
              if (!apiKey.startsWith("eyJ")) searchUrl += `&api_key=${apiKey}`;

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

            if (tmdbId) {
              let detailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?language=ru-RU`;
              if (!apiKey.startsWith("eyJ")) detailsUrl += `&api_key=${apiKey}`;

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

                if (
                  us.show.episodes.length === 0 &&
                  Array.isArray(tvData.seasons)
                ) {
                  const episodesToCreate: {
                    showId: number;
                    season: number;
                    episode: number;
                  }[] = [];
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
            console.error("Ошибка синхронизации серий с TMDB:", e);
          }
        }
      }
    }

    const notes = await prisma.personalNote.findMany({where:{userId:currentUserId, text:{not:""}},select:{showId:true}});
    const noted = new Set(notes.map(n=>n.showId));
    const normalized = userShows.map((us) => {
      const isMovie = us.show.kind === "movie";
      const summary = summarizeProgress(us);
      const totalEpisodes = summary.total;
      const validIds = new Set(us.show.episodes.map((episode) => episode.id));

      return {
        id: us.showId,
        userShowId: us.id,
        showId: us.showId,
        name: us.show?.name || "Без названия",
        title: us.show?.name || "Без названия",
        originalName: us.show?.originalName,
        originalTitle: us.show?.originalName,
        posterUrl: formatPosterUrl(us.show?.posterUrl),
        year:
          us.show?.year ||
          (us.show?.releaseDate
            ? new Date(us.show.releaseDate).getFullYear().toString()
            : ""),
        kind: isMovie ? "movie" : "series",
        status: us.status || "watching",
        isCompleted: us.status === "completed",
        isFavorite: us.isFavorite,
        hasNote: noted.has(us.showId),
        totalSeasons: us.totalSeasons || 1,
        totalEpisodes,
        dubbing: us.dubbing,
        watchSite: us.watchSite,
        rating:
          us.ratings?.[0]?.score ||
          (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
        userRating:
          us.ratings.find((rating) => rating.episodeId === null)?.score ?? null,
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
        progress: us.progress.filter((progress) =>
          validIds.has(progress.episodeId),
        ),
        ratings: us.ratings || [],
        updatedAt: us.updatedAt,
        createdAt: us.createdAt,
      };
    });

    return NextResponse.json(safeJson(normalized));
  } catch (error: unknown) {
    console.error("Library unavailable", error);
    return NextResponse.json({ error: "База данных временно недоступна. Повторите загрузку." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const id = Number(body?.showId ?? body?.tmdbId);
    const item = await saveLibrary(userId, id, body);
    return NextResponse.json(
      safeJson({ success: true, item, showId: item.showId }),
    );
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

// Удаление из планов не должно незаметно переводить тайтл в «смотрю».
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const showId = Number(new URL(request.url).searchParams.get("showId"));
  if (!Number.isSafeInteger(showId) || showId <= 0)
    return NextResponse.json({ error: "Invalid showId" }, { status: 400 });
  const result = await prisma.userShow.deleteMany({
    where: { userId, showId, status: "planned" },
  });
  if (!result.count)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
