import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 1. Находим всех друзей
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: me.id }, { addresseeId: me.id }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const friendIds = friendships.map((f) =>
    f.requesterId === me.id ? f.addresseeId : f.requesterId
  );

  if (friendIds.length === 0) {
    return NextResponse.json([]);
  }

  // 2. Ищем последние просмотренные серии (watchedAt за последние 30 дней)
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const episodes = await prisma.episode.findMany({
    where: {
      watched: true,
      watchedAt: { gte: since },
      title: { userId: { in: friendIds } },
    },
    orderBy: { watchedAt: "desc" },
    take: 50,
    include: {
      title: {
        select: {
          id: true,
          name: true,
          posterUrl: true,
          kind: true,
          userId: true,
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  // 3. Группируем: по паре (friend, title) берём последнюю активность
  //    Исключаем сериалы, которые уже закончились
  const seen = new Set<string>();
  const activity: any[] = [];

  for (const ep of episodes) {
    const key = `${ep.title.userId}-${ep.title.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Считаем прогресс: сколько серий просмотрено в этом сериале
    const [watchedCount, totalCount] = await Promise.all([
      prisma.episode.count({
        where: { titleId: ep.title.id, watched: true },
      }),
      prisma.episode.count({ where: { titleId: ep.title.id } }),
    ]);

    activity.push({
      user: ep.title.user,
      title: {
        id: ep.title.id,
        name: ep.title.name,
        posterUrl: ep.title.posterUrl,
        kind: ep.title.kind,
      },
      episode: {
        season: ep.season,
        episode: ep.episode,
        watchedAt: ep.watchedAt,
      },
      progress: {
        watched: watchedCount,
        total: totalCount,
      },
    });

    if (activity.length >= 15) break;
  }

  return NextResponse.json(activity);
}