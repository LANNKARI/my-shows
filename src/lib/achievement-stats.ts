import { prisma } from "@/lib/prisma";
import { summarizeLibrary } from "@/lib/progress";

export async function achievementStats(userId: string) {
  const [entries, commentsCount, friendsCount, user] = await Promise.all([
    prisma.userShow.findMany({
      where: { userId },
      include: {
        show: { include: { episodes: true } },
        ratings: true,
        progress: true,
      },
    }),
    prisma.comment.count({ where: { userId } }),
    prisma.friendship.count({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
  ]);
  const summary = summarizeLibrary(entries);
  return {
    ...summary,
    addedShowsCount: summary.addedSeriesCount,
    commentsCount,
    friendsCount,
    daysRegistered: user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)
      : 0,
  };
}
