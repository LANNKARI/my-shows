import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  timeZone,
  CalendarError,
} from "@/lib/calendar-server";
import { dayDate, todayInZone } from "@/lib/calendar-dates";
export async function GET(request: NextRequest) {
  try {
    const id = await calendarUser(request);
    return privateJson(
      await prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          releaseNotificationsEnabled: true,
          notifyNewShows: true,
          notificationTimeZone: true,
        },
      }),
    );
  } catch (error) {
    return calendarFailure(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true),
      body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new CalendarError(400, "Некорректный запрос");
    const zone = timeZone(body.timeZone);
    if (body.userShowId !== undefined) {
      if (
        !Number.isSafeInteger(body.userShowId) ||
        body.userShowId <= 0 ||
        typeof body.notifyReleases !== "boolean"
      )
        throw new CalendarError(400, "Некорректная подписка");
      const count = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        return tx.$executeRaw`UPDATE "UserShow" SET "notifyReleases" = ${body.notifyReleases}, "notifySince" = CASE WHEN ${body.notifyReleases} AND NOT "notifyReleases" THEN ${dayDate(todayInZone(zone))}::date ELSE "notifySince" END WHERE id = ${body.userShowId} AND "userId" = ${userId} AND EXISTS (SELECT 1 FROM "Show" WHERE "Show".id = "UserShow"."showId" AND kind = 'series')`;
      });
      if (!count) throw new CalendarError(404, "Сериал не найден");
      return privateJson({
        success: true,
        notifyReleases: body.notifyReleases,
      });
    }
    if (
      !["releaseNotificationsEnabled", "notifyNewShows"].some(
        (key) => key in body,
      ) ||
      ["releaseNotificationsEnabled", "notifyNewShows"].some(
        (key) => body[key] !== undefined && typeof body[key] !== "boolean",
      )
    )
      throw new CalendarError(400, "Некорректные настройки");
    const preferences = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.releaseNotificationsEnabled !== undefined
          ? { releaseNotificationsEnabled: body.releaseNotificationsEnabled }
          : {}),
        ...(body.notifyNewShows !== undefined
          ? { notifyNewShows: body.notifyNewShows }
          : {}),
        notificationTimeZone: zone,
      },
      select: {
        releaseNotificationsEnabled: true,
        notifyNewShows: true,
        notificationTimeZone: true,
      },
    });
    return privateJson(preferences);
  } catch (error) {
    return calendarFailure(error);
  }
}
