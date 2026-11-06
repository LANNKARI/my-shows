import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import { premiumActive } from "@/lib/premium";
export async function GET(req: NextRequest) {
  try {
    const id = await calendarUser(req);
    if (!(await premiumActive(id)))
      throw new CalendarError(403, "Расширенная статистика доступна с Premium");
    const days = Number(req.nextUrl.searchParams.get("days") || 30);
    if (![30, 90, 365].includes(days))
      throw new CalendarError(400, "Некорректный период");
    const end = new Date(),
      start = new Date(end);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const rows = await prisma.episodeProgress.findMany({
      where: {
        watched: true,
        watchedAt: { gte: start, lte: end },
        userShow: { userId: id },
      },
      select: {
        watchedAt: true,
        episode: { select: { showId: true } },
        userShow: {
          select: {
            showId: true,
            show: { select: { kind: true, runtime: true, genres: true } },
          },
        },
      },
    });
    const undated = await prisma.episodeProgress.count({
      where: { watched: true, watchedAt: null, userShow: { userId: id } },
    });
    const bins: Record<
        string,
        { date: string; movies: number; episodes: number; minutes: number }
      > = {},
      genres: Record<string, number> = {},
      titles = new Set<number>(),
      movies = new Set<number>();
    let minutes = 0,
      estimated = 0;
    for (let n = 0; n < days; n++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + n);
      const date = d.toISOString().slice(0, 10);
      bins[date] = { date, movies: 0, episodes: 0, minutes: 0 };
    }
    for (const row of rows) {
      if (row.episode.showId !== row.userShow.showId) continue;
      const show = row.userShow.show,
        isMovie = show.kind === "movie";
      if (isMovie && movies.has(row.userShow.showId)) continue;
      const date = row.watchedAt!.toISOString().slice(0, 10),
        bin = bins[date];
      if (!bin) continue;
      const duration = show.runtime || (isMovie ? 110 : 45);
      if (!show.runtime) estimated++;
      titles.add(row.userShow.showId);
      if (isMovie) {
        movies.add(row.userShow.showId);
        bin.movies++;
      } else bin.episodes++;
      bin.minutes += duration;
      minutes += duration;
      for (const g of show.genres) genres[g] = (genres[g] || 0) + 1;
    }
    return privateJson({
      days,
      start: start.toISOString(),
      end: end.toISOString(),
      minutes,
      movies: movies.size,
      episodes: Object.values(bins).reduce((s, b) => s + b.episodes, 0),
      titles: titles.size,
      estimated,
      undated,
      daily: Object.values(bins),
      genres: Object.entries(genres)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
