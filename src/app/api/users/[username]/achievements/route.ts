import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAchievements } from "@/lib/achievements";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, createdAt: true },
  });

  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // ── Статистика по НОВОЙ схеме ──
  const [
    userShowsCount,
    completedCount,
    ratingsCount,
    commentsCount,
    watchedEpisodes,
    friendsCount,
  ] = await Promise.all([
    // Сколько сериалов в библиотеке (UserShow)
    prisma.userShow.count({ where: { userId: user.id } }),

    // Сколько просмотрено полностью
    prisma.userShow.count({
      where: { userId: user.id, isCompleted: true },
    }),

    // Сколько оценок поставлено — через UserShow
    prisma.rating.count({
      where: { userShow: { userId: user.id } },
    }),

    // Сколько комментариев
    prisma.comment.count({ where: { userId: user.id } }),

    // Сколько серий просмотрено — личный прогресс
    prisma.episodeProgress.count({
      where: {
        userShow: { userId: user.id },
        watched: true,
      },
    }),

    // Сколько друзей
    prisma.friendship.count({
      where: {
        status: "accepted",
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
    }),
  ]);

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const achievements = calculateAchievements({
    totalTitles: userShowsCount,
    completedTitles: completedCount,
    totalWatchedEpisodes: watchedEpisodes,
    totalRatings: ratingsCount,
    totalComments: commentsCount,
    totalFriends: friendsCount,
    accountAgeDays,
  });

  const unlocked = achievements.filter((a) => a.unlocked);
  const inProgress = achievements.filter(
    (a) => !a.unlocked && a.progress.current > 0
  );

  return NextResponse.json({
    all: achievements,
    unlocked,
    inProgress,
    stats: {
      totalTitles: userShowsCount,
      completedTitles: completedCount,
      totalWatchedEpisodes: watchedEpisodes,
      totalRatings: ratingsCount,
      totalComments: commentsCount,
      totalFriends: friendsCount,
      accountAgeDays,
    },
  });
}