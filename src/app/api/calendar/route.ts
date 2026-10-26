import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  queryRange,
  CalendarError,
} from "@/lib/calendar-server";
import { dayDate } from "@/lib/calendar-dates";
import { formatPosterUrl } from "@/lib/current-user";
import { scheduleDue } from "@/lib/release-schedule";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request),
      { from, to } = queryRange(request);
    const filter = request.nextUrl.searchParams.get("status") || "watching";
    if (!["watching", "planned", "completed", "all"].includes(filter))
      throw new CalendarError(400, "Некорректный фильтр");
    const entries = await prisma.userShow.findMany({
      where: {
        userId,
        status:
          filter === "all"
            ? { in: ["watching", "planned", "completed"] }
            : filter,
        show: { kind: "series" },
      },
      include: {
        show: {
          include: {
            episodes: {
              where: { airDate: { gte: dayDate(from), lte: dayDate(to) } },
              orderBy: [
                { airDate: "asc" },
                { season: "asc" },
                { episode: "asc" },
              ],
            },
          },
        },
        progress: {
          where: {
            watched: true,
            episode: { airDate: { gte: dayDate(from), lte: dayDate(to) } },
          },
          select: { episodeId: true },
        },
      },
      orderBy: { id: "asc" },
    });
    const events = entries
      .flatMap((entry) => {
        const watched = new Set(entry.progress.map((value) => value.episodeId));
        return entry.show.episodes.map((episode) => ({
          id: episode.id,
          showId: entry.showId,
          userShowId: entry.id,
          title: entry.show.name,
          posterUrl: formatPosterUrl(entry.show.posterUrl),
          season: episode.season,
          episode: episode.episode,
          date: episode.airDate!.toISOString().slice(0, 10),
          notifyReleases: entry.notifyReleases,
          watched: watched.has(episode.id),
        }));
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.title.localeCompare(b.title, "ru") ||
          a.season - b.season ||
          a.episode - b.episode,
      );
    return privateJson({
      events: events.slice(0, 1000),
      truncated: events.length > 1000,
      series: entries.map((entry) => ({
        userShowId: entry.id,
        showId: entry.showId,
        title: entry.show.name,
        notifyReleases: entry.notifyReleases,
        hasSource: !!entry.show.tmdbId,
        syncedAt: entry.show.calendarSyncedAt,
        needsSync: scheduleDue(entry.show, from, to),
      })),
      syncIds: entries
        .filter((entry) => scheduleDue(entry.show, from, to))
        .map((entry) => entry.showId),
    });
  } catch (error) {
    return calendarFailure(error);
  }
}
