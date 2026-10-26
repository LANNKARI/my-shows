import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, dayDate } from "@/lib/calendar-dates";
export async function materializeReleases(
  userId: string,
  today: string,
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { releaseNotificationsEnabled: true },
    });
    if (!user?.releaseNotificationsEnabled) return;
    const entries = await tx.userShow.findMany({
      where: {
        userId,
        notifyReleases: true,
        notifySince: { not: null },
        status: { not: "dropped" },
        show: { kind: "series" },
      },
      include: {
        show: {
          include: {
            episodes: {
              where: {
                airDate: {
                  gte: dayDate(addDays(today, -30)),
                  lte: dayDate(today),
                },
              },
              select: { id: true, airDate: true },
            },
          },
        },
        progress: { where: { watched: true }, select: { episodeId: true } },
      },
    });
    const notifications = entries.flatMap((entry) => {
      const watched = new Set(
        entry.progress.map((progress) => progress.episodeId),
      );
      return entry.show.episodes
        .filter(
          (episode) =>
            episode.airDate! >= entry.notifySince! && !watched.has(episode.id),
        )
        .map((episode) => ({ userShowId: entry.id, episodeId: episode.id }));
    });
    if (notifications.length)
      await tx.releaseNotification.createMany({
        data: notifications,
        skipDuplicates: true,
      });
  });
}
