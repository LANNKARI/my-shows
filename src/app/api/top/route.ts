import { summarizeLibrary } from "@/lib/progress";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAchievements } from "@/lib/achievements";
import { safeJson } from "@/lib/current-user";

export async function GET() {
  try {
    // 1. Загружаем пользователей с их связями
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        userShows: {
          select: {
            id: true,
            status: true,
            isCompleted: true,
            kind: true,
            totalEpisodes: true,
            show: { include: { episodes: true } },
            ratings: { select: { score: true, episodeId: true } },
            progress: { select: { watched: true, episodeId: true } },
          },
        },
      },
    });

    // 2. Подсчёт комментариев пользователей
    let commentsMap = new Map<string, number>();
    try {
      const commentCounts = await prisma.comment.groupBy({
        by: ["userId"],
        _count: { id: true },
      });
      commentsMap = new Map(commentCounts.map((c) => [c.userId, c._count.id]));
    } catch {
      // Игнорируем, если таблица комментариев пуста
    }

    // 3. Подсчёт подтверждённых друзей
    const friendsMap = new Map<string, number>();
    try {
      const acceptedFriendships = await prisma.friendship.findMany({
        where: { status: "accepted" },
        select: { requesterId: true, addresseeId: true },
      });
      for (const f of acceptedFriendships) {
        friendsMap.set(f.requesterId, (friendsMap.get(f.requesterId) || 0) + 1);
        friendsMap.set(f.addresseeId, (friendsMap.get(f.addresseeId) || 0) + 1);
      }
    } catch {
      // Игнорируем, если таблица дружбы пуста
    }

    // 4. Формирование рейтинга для каждого пользователя
    const result = users.map((u) => {
      const {
        totalTitles: showsCount,
        completedCount,
        watchedEpisodesCount,
        ratingsCount,
        completedSeriesCount,
        addedSeriesCount,
      } = summarizeLibrary(u.userShows);

      const commentsCount = commentsMap.get(u.id) || 0;
      const friendsCount = friendsMap.get(u.id) || 0;
      const daysRegistered = Math.floor(
        (Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      // Расчёт значков достижений
      const achievements = calculateAchievements({
        totalTitles: showsCount,
        addedShowsCount: addedSeriesCount,
        totalEpisodes: watchedEpisodesCount,
        watchedEpisodesCount,
        totalRatings: ratingsCount,
        ratingsCount,
        completedSeriesCount,
        commentsCount,
        friendsCount,
        daysRegistered,
      });

      const badges = achievements.filter((a) => a.unlocked);

      // Формула активных очков: (завершено * 10) + оценки + комментарии (минимум от добавленных тайтлов)
      const baseScore = completedCount * 10 + ratingsCount + commentsCount * 2;
      const activeScore = Math.max(baseScore, showsCount);

      return {
        id: u.id,
        username: u.username,
        name: u.name || u.username,
        avatarUrl: u.avatarUrl,
        score: activeScore,
        points: activeScore,
        showsCount,
        completedCount,
        ratingsCount,
        commentsCount,
        badges,
        achievements: badges,
      };
    });

    return NextResponse.json(safeJson(result));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
