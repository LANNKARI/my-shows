import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Друзья
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: me.id }, { addresseeId: me.id }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const friendIds = friendships.map((f) =>
    f.requesterId === me.id ? f.addresseeId : f.requesterId,
  );

  if (friendIds.length === 0) return NextResponse.json([]);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Личные прогрессы друзей — последние просмотренные серии
  const progresses = await prisma.episodeProgress.findMany({
    where: {
      watched: true,
      watchedAt: { gte: since },
      userShow: { userId: { in: friendIds } },
    },
    orderBy: { watchedAt: "desc" },
    take: 100,
    include: {
      episode: { select: { showId: true, season: true, episode: true } },
      userShow: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
          show: {
            select: { id: true, name: true, posterUrl: true, kind: true },
          },
        },
      },
    },
  });

  // Группируем по (user + show)
  const seen = new Set<string>();
  const activity = [];

  for (const p of progresses) {
    if (p.episode.showId !== p.userShow.showId) continue;
    const key = `${p.userShow.userId}-${p.userShow.showId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Считаем прогресс
    const [watchedCount, totalCount] = await Promise.all([
      prisma.episodeProgress.count({
        where: {
          userShowId: p.userShow.id,
          watched: true,
          episode: { showId: p.userShow.showId },
        },
      }),
      prisma.episode.count({ where: { showId: p.userShow.showId } }),
    ]);

    activity.push({
      user: p.userShow.user,
      title: p.userShow.show,
      episode: {
        season: p.episode.season,
        episode: p.episode.episode,
        watchedAt: p.watchedAt,
      },
      progress: {
        watched:
          p.userShow.show.kind === "movie"
            ? Math.min(1, watchedCount)
            : watchedCount,
        total:
          p.userShow.show.kind === "movie"
            ? 1
            : Math.max(totalCount, p.userShow.totalEpisodes),
      },
    });

    if (activity.length >= 15) break;
  }

  return NextResponse.json(activity);
}
