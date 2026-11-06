import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
  timeZone,
} from "@/lib/calendar-server";
import { premiumActive } from "@/lib/premium";
import { viewingStatistics } from "@/lib/viewing-statistics";
export async function GET(req: NextRequest) {
  try {
    const id = await calendarUser(req);
    if (!(await premiumActive(id)))
      throw new CalendarError(403, "Расширенная статистика доступна с Premium");
    const days = Number(req.nextUrl.searchParams.get("days") || 30);
    if (![30, 90, 365].includes(days))
      throw new CalendarError(400, "Некорректный период");
    const zone = timeZone(req.nextUrl.searchParams.get("timeZone"));
    // Select only fields used by the report, never descriptions, cast, notes, or other users' libraries.
    const entries = await prisma.userShow.findMany({
      where: { userId: id },
      select: {
        status: true,
        totalEpisodes: true,
        show: {
          select: {
            id: true,
            kind: true,
            runtime: true,
            year: true,
            genres: true,
            countries: true,
            episodes: { select: { id: true, season: true } },
          },
        },
        progress: {
          where: { watched: true },
          select: {
            episodeId: true,
            watched: true,
            watchedAt: true,
            statisticsSource: true,
          },
        },
        ratings: {
          where: { episodeId: null },
          select: { episodeId: true, score: true, createdAt: true },
        },
      },
    });
    const stats = viewingStatistics(entries, days, zone);
    // Aggregate counters in SQL. A movie counts once, a canonical series episode once. No user IDs leave this query.
    const [ranking] = await prisma.$queryRaw<
      { participants: bigint; below: bigint; views: bigint }[]
    >`
   WITH counts AS (
    SELECT us."userId", SUM(CASE WHEN s.kind='movie' THEN CASE WHEN us.status='completed' OR p.n>0 THEN 1 ELSE 0 END ELSE p.n END)::bigint AS views
    FROM "UserShow" us JOIN "Show" s ON s.id=us."showId"
    CROSS JOIN LATERAL (SELECT count(DISTINCT ep."episodeId") AS n FROM "EpisodeProgress" ep JOIN "Episode" e ON e.id=ep."episodeId" AND e."showId"=us."showId" WHERE ep."userShowId"=us.id AND ep.watched=true) p
    GROUP BY us."userId"
   ), me AS (SELECT COALESCE((SELECT views FROM counts WHERE "userId"=${id}),0)::bigint AS views)
   SELECT count(*) FILTER (WHERE c."userId"<>${id}) AS participants,
    count(*) FILTER (WHERE c."userId"<>${id} AND c.views<me.views) AS below,
    max(me.views) AS views FROM me LEFT JOIN counts c ON c.views>0`;
    const participants = Number(ranking?.participants || 0),
      views = Number(ranking?.views || 0);
    return privateJson({
      ...stats,
      percentile: {
        value:
          participants && views > 0
            ? Math.floor((Number(ranking.below) / participants) * 100)
            : null,
        participants,
        views,
      },
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
