import { Prisma, type PrismaClient, type Show } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validDay, dayDate } from "@/lib/calendar-dates";
export const scheduleDue = (
  show: Pick<
    Show,
    | "tmdbId"
    | "calendarSyncedAt"
    | "calendarAttemptedAt"
    | "calendarSyncFrom"
    | "calendarSyncTo"
  >,
  from: string,
  to: string,
  now = Date.now(),
) =>
  !!show.tmdbId &&
  !(
    show.calendarAttemptedAt && now - show.calendarAttemptedAt.getTime() < 60000
  ) &&
  !(
    show.calendarSyncedAt &&
    now - show.calendarSyncedAt.getTime() < 6 * 3600000 &&
    show.calendarSyncFrom &&
    show.calendarSyncTo &&
    show.calendarSyncFrom <= dayDate(from) &&
    show.calendarSyncTo >= dayDate(to)
  );
export type FetchSchedule = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;
type Season = {
  season_number: number;
  air_date?: string | null;
  episode_count: number;
};
type RemoteEpisode = {
  episode_number: number;
  air_date?: string | null;
  name?: string;
};
export async function syncShowSchedule(
  show: Show,
  range: { from: string; to: string },
  options: {
    db?: PrismaClient;
    fetcher?: FetchSchedule;
    apiKey?: string;
    now?: Date;
  } = {},
) {
  const db = options.db || prisma,
    fetcher = options.fetcher || fetch;
  const key =
    options.apiKey ??
    (process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      "");
  const now = options.now || new Date();
  if (!key || !show.tmdbId) return { ok: false, reason: "unavailable" };
  const claim = await db.show.updateMany({
    where: {
      id: show.id,
      OR: [
        { calendarAttemptedAt: null },
        { calendarAttemptedAt: { lt: new Date(now.getTime() - 60000) } },
      ],
    },
    data: { calendarAttemptedAt: now },
  });
  if (!claim.count) return { ok: false, reason: "busy" };
  try {
    const headers: Record<string, string> = key.startsWith("eyJ")
      ? { Authorization: `Bearer ${key}` }
      : {};
    async function get(path: string) {
      const url = new URL(
        `https://api.themoviedb.org/3/tv/${show.tmdbId}${path}`,
      );
      url.searchParams.set("language", "ru-RU");
      if (!key!.startsWith("eyJ")) url.searchParams.set("api_key", key!);
      const response = await fetcher(url.toString(), {
        headers,
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Schedule source unavailable");
      return response.json();
    }
    const details = await get("");
    if (!Array.isArray(details.seasons)) throw new Error("Invalid schedule");
    const seasons: Season[] = (
      Array.isArray(details.seasons) ? details.seasons : []
    )
      .filter(
        (season: Season) =>
          Number.isSafeInteger(season.season_number) &&
          season.season_number > 0 &&
          season.episode_count > 0,
      )
      .sort((a: Season, b: Season) => a.season_number - b.season_number);
    const relevant = seasons.filter((season, index) => {
      const start = validDay(season.air_date) ? season.air_date : null;
      const next = seasons
        .slice(index + 1)
        .find((value) => validDay(value.air_date))?.air_date;
      return (!start || start <= range.to) && (!next || next >= range.from);
    });
    if (relevant.length > 6) return { ok: false, reason: "partial" };
    // Fetch at most six seasons, with two bounded batches; never hold a DB transaction during HTTP.
    const rows: {
      season: number;
      episode: number;
      airDate: string | null;
      name: string | null;
    }[] = [];
    for (let offset = 0; offset < relevant.length; offset += 3) {
      const batch = await Promise.all(
        relevant.slice(offset, offset + 3).map(async (season) => {
          const data = await get(`/season/${season.season_number}`);
          if (!Array.isArray(data.episodes) || data.episodes.length > 2000)
            throw new Error("Invalid schedule");
          return (data.episodes as RemoteEpisode[])
            .filter(
              (episode) =>
                Number.isSafeInteger(episode.episode_number) &&
                episode.episode_number > 0,
            )
            .map((episode) => ({
              season: season.season_number,
              episode: episode.episode_number,
              airDate: validDay(episode.air_date) ? episode.air_date : null,
              name:
                typeof episode.name === "string"
                  ? episode.name.slice(0, 500)
                  : null,
            }));
        }),
      );
      rows.push(...batch.flat());
    }
    await db.$transaction(async (tx) => {
      // Catalogue metadata only: personal watched flags, dates and timecodes are never rewritten.
      for (let offset = 0; offset < rows.length; offset += 1000) {
        const values = rows
          .slice(offset, offset + 1000)
          .map(
            (row) =>
              Prisma.sql`(${show.id}, ${row.season}, ${row.episode}, ${row.airDate}::date, ${row.name})`,
          );
        if (values.length)
          await tx.$executeRaw(
            Prisma.sql`INSERT INTO "Episode" ("showId", season, episode, "airDate", name) VALUES ${Prisma.join(values)} ON CONFLICT ("showId", season, episode) DO UPDATE SET "airDate" = EXCLUDED."airDate", name = EXCLUDED.name`,
          );
      }
      await tx.show.update({
        where: { id: show.id },
        data: {
          calendarSyncedAt: now,
          calendarSyncFrom: dayDate(range.from),
          calendarSyncTo: dayDate(range.to),
        },
      });
    });
    return { ok: true, episodes: rows.length };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
