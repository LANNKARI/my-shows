import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { dayDate, todayInZone } from "@/lib/calendar-dates";
export async function releaseDefaults(
  userId: string,
  kind: string,
  db: Prisma.TransactionClient = prisma,
) {
  if (kind !== "series") return {};
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { notifyNewShows: true, notificationTimeZone: true },
  });
  return user?.notifyNewShows
    ? {
        notifyReleases: true,
        notifySince: dayDate(todayInZone(user.notificationTimeZone)),
      }
    : {};
}
