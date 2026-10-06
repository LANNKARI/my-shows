import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAchievements } from "@/lib/achievements";

export async function GET(req: NextRequest) {
  const category =
    new URL(req.url).searchParams.get("category") || "active";

  // ── Собираем всех пользователей ──
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  // ── Для каждого — считаем метрики по НОВОЙ схеме ──
  const enriched = await Promise.all(
    users.map(async (u) => {
      const [
        userShowsCount,   // сериалов в библиотеке
        completedCount,   // просмотренных полностью
        ratingsCount,     // оценок поставлено
        commentsCount,    // комментариев
        watchedEpisodes,  // серий просмотрено
        friendsCount,     // друзей
      ] = await Promise.all([
        prisma.userShow.count({ where: { userId: u.id } }),
        prisma.userShow.count({
          where: { userId: u.id, isCompleted: true },
        }),
        prisma.rating.count({
          where: { userShow: { userId: u.id } },
        }),
        prisma.comment.count({ where: { userId: u.id } }),
        prisma.episodeProgress.count({
          where: {
            userShow: { userId: u.id },
            watched: true,
          },
        }),
        prisma.friendship.count({
          where: {
            status: "accepted",
            OR: [{ requesterId: u.id }, { addresseeId: u.id }],
          },
        }),
      ]);

      const score =
        userShowsCount * 3 +
        ratingsCount * 2 +
        commentsCount * 5 +
        completedCount * 4;

      const accountAgeDays = Math.floor(
        (Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const badges = calculateAchievements({
        totalTitles: userShowsCount,
        completedTitles: completedCount,
        totalWatchedEpisodes: watchedEpisodes,
        totalRatings: ratingsCount,
        totalComments: commentsCount,
        totalFriends: friendsCount,
        accountAgeDays,
      })
        .filter((a) => a.unlocked)
        .sort((a, b) => {
          const order: Record<string, number> = {
            legendary: 0,
            gold: 1,
            silver: 2,
            bronze: 3,
          };
          return order[a.tier] - order[b.tier];
        })
        .slice(0, 3);

      return {
        id: u.id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        metrics: {
          titles: userShowsCount,
          ratings: ratingsCount,
          comments: commentsCount,
          watchedEpisodes,
          completed: completedCount,
          friends: friendsCount,
          score,
        },
        badges,
      };
    })
  );

  // ── Сортировка по категории ──
  const sorted = [...enriched].sort((a, b) => {
    if (category === "titles") return b.metrics.titles - a.metrics.titles;
    if (category === "ratings") return b.metrics.ratings - a.metrics.ratings;
    if (category === "comments")
      return b.metrics.comments - a.metrics.comments;
    return b.metrics.score - a.metrics.score; // "active"
  });

  // ── Топ-50, скрываем тех, у кого 0 по категории ──
  const filtered = sorted
    .filter((u) => {
      if (category === "titles") return u.metrics.titles > 0;
      if (category === "ratings") return u.metrics.ratings > 0;
      if (category === "comments") return u.metrics.comments > 0;
      return u.metrics.score > 0;
    })
    .slice(0, 50);

  return NextResponse.json(filtered);
}