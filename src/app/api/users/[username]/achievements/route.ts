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

  // Считаем статистику
  const [titlesCount, completedCount, ratingsCount, commentsCount] =
    await Promise.all([
      prisma.title.count({ where: { userId: user.id } }),
      prisma.title.count({ where: { userId: user.id, isCompleted: true } }),
      prisma.rating.count({ where: { title: { userId: user.id } } }),
      prisma.comment.count({ where: { userId: user.id } }),
    ]);

  const watchedEpisodes = await prisma.episode.count({
    where: { title: { userId: user.id }, watched: true },
  });

  const friendsCount = await prisma.friendship.count({
    where: {
      status: "accepted",
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
  });

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const achievements = calculateAchievements({
    totalTitles: titlesCount,
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
      totalTitles: titlesCount,
      completedTitles: completedCount,
      totalWatchedEpisodes: watchedEpisodes,
      totalRatings: ratingsCount,
      totalComments: commentsCount,
      totalFriends: friendsCount,
      accountAgeDays,
    },
  });
}