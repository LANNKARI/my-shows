import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
} from "@/lib/calendar-server";
import { formatPosterUrl } from "@/lib/current-user";
import { summarizeProgress } from "@/lib/progress";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request);
    // Rank in PostgreSQL before loading episode lists, so a large library does
    // not get serialized and transferred on every visit to the home page.
    const selected = await prisma.$queryRaw<{ id: number }[]>`
      SELECT u.id FROM "UserShow" u JOIN "Show" s ON s.id=u."showId"
      LEFT JOIN LATERAL (
        SELECT e.id FROM "Episode" e LEFT JOIN "EpisodeProgress" p ON p."episodeId"=e.id AND p."userShowId"=u.id
        WHERE e."showId"=u."showId" AND COALESCE(p.watched,false)=false
        ORDER BY e.season,e.episode,e.id LIMIT 1
      ) n ON true
      LEFT JOIN "EpisodeProgress" np ON np."episodeId"=n.id AND np."userShowId"=u.id
      LEFT JOIN LATERAL (
        SELECT MAX(p."updatedAt") AS recent FROM "EpisodeProgress" p JOIN "Episode" e ON e.id=p."episodeId" AND e."showId"=u."showId" WHERE p."userShowId"=u.id
      ) activity ON true
      WHERE u."userId"=${userId} AND u.status='watching' AND (s.kind<>'movie' OR NOT EXISTS (
        SELECT 1 FROM "EpisodeProgress" p JOIN "Episode" e ON e.id=p."episodeId" AND e."showId"=u."showId" WHERE p."userShowId"=u.id AND p.watched=true
      )) ORDER BY (NULLIF(np."stoppedAt",'') IS NOT NULL) DESC, GREATEST(u."createdAt",COALESCE(activity.recent,u."createdAt")) DESC,u.id DESC LIMIT 6`;
    const entries = await prisma.userShow.findMany({
      where: { userId, id: { in: selected.map((v) => v.id) } },
      include: {
        show: {
          select: {
            id: true,
            name: true,
            kind: true,
            posterUrl: true,
            episodes: {
              select: { id: true, season: true, episode: true },
              orderBy: [{ season: "asc" }, { episode: "asc" }, { id: "asc" }],
            },
          },
        },
        progress: {
          select: {
            episodeId: true,
            watched: true,
            stoppedAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const items = entries
      .map((entry) => {
        const valid = new Set(entry.show.episodes.map((e) => e.id));
        const progress = entry.progress.filter((p) => valid.has(p.episodeId));
        const watched = new Set(
          progress.filter((p) => p.watched).map((p) => p.episodeId),
        );
        const next = entry.show.episodes.find((e) => !watched.has(e.id));
        const stoppedAt = next
          ? progress.find((p) => p.episodeId === next.id)?.stoppedAt
          : null;
        return {
          showId: entry.showId,
          title: entry.show.name,
          kind: entry.kind,
          posterUrl: formatPosterUrl(entry.show.posterUrl),
          next: next ? { season: next.season, episode: next.episode } : null,
          stoppedAt: stoppedAt || null,
          ...summarizeProgress(entry),
          lastActivity: Math.max(
            entry.createdAt.getTime(),
            ...progress.map((p) => p.updatedAt.getTime()),
          ),
        };
      })
      .filter((e) => !(e.kind === "movie" && e.complete))
      .sort(
        (a, b) =>
          Number(!!b.stoppedAt) - Number(!!a.stoppedAt) ||
          b.lastActivity - a.lastActivity,
      )
      .slice(0, 6);
    return privateJson(items);
  } catch (error) {
    return calendarFailure(error);
  }
}
