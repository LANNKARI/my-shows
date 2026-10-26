import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  timeZone,
  CalendarError,
} from "@/lib/calendar-server";
import { addDays, dayDate, todayInZone } from "@/lib/calendar-dates";
import { scheduleDue, syncShowSchedule } from "@/lib/release-schedule";
import { materializeReleases } from "@/lib/release-notifications";
import { formatPosterUrl } from "@/lib/current-user";
export const maxDuration = 30;
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request),
      zone = timeZone(request.nextUrl.searchParams.get("timeZone"));
    const today = todayInZone(zone),
      mode = request.nextUrl.searchParams.get("mode") || "all";
    const rawCursor = request.nextUrl.searchParams.get("cursor"),
      cursor = rawCursor === null ? undefined : Number(rawCursor);
    if (
      !["all", "unread"].includes(mode) ||
      (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor <= 0))
    )
      throw new CalendarError(400, "Некорректный запрос");
    const preferences = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        releaseNotificationsEnabled: true,
        notifyNewShows: true,
        notificationTimeZone: true,
      },
    });
    if (preferences.releaseNotificationsEnabled) {
      const subscriptions = await prisma.userShow.findMany({
        where: {
          userId,
          notifyReleases: true,
          status: { not: "dropped" },
          show: { kind: "series", tmdbId: { not: null } },
        },
        include: { show: true },
        orderBy: {
          show: { calendarAttemptedAt: { sort: "asc", nulls: "first" } },
        },
      });
      const range = { from: addDays(today, -7), to: addDays(today, 7) };
      const due = subscriptions.find((entry) =>
        scheduleDue(entry.show, range.from, range.to),
      );
      if (due) await syncShowSchedule(due.show, range);
      await materializeReleases(userId, today);
    }
    const base = {
      userShow: { userId },
      episode: { airDate: { lte: dayDate(today) } },
    };
    const [rows, unreadCount, latest] = await Promise.all([
      prisma.releaseNotification.findMany({
        where: {
          ...base,
          ...(mode === "unread" ? { readAt: null } : {}),
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { id: "desc" },
        take: 31,
        include: { episode: true, userShow: { include: { show: true } } },
      }),
      prisma.releaseNotification.count({ where: { ...base, readAt: null } }),
      prisma.releaseNotification.findFirst({
        where: base,
        orderBy: { id: "desc" },
        select: { id: true },
      }),
    ]);
    const items = rows
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        showId: row.userShow.showId,
        title: row.userShow.show.name,
        posterUrl: formatPosterUrl(row.userShow.show.posterUrl),
        season: row.episode.season,
        episode: row.episode.episode,
        date: row.episode.airDate!.toISOString().slice(0, 10),
        read: !!row.readAt,
      }));
    return privateJson({
      items,
      unreadCount,
      latestId: latest?.id || 0,
      nextCursor: rows.length > 30 ? items.at(-1)!.id : null,
      preferences,
    });
  } catch (error) {
    return calendarFailure(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true),
      body = await request.json().catch(() => null);
    const today = todayInZone(
      timeZone(request.nextUrl.searchParams.get("timeZone")),
    );
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new CalendarError(400, "Некорректный запрос");
    const all = body.all === true;
    if (
      all
        ? body.ids !== undefined ||
          !Number.isSafeInteger(body.throughId) ||
          body.throughId < 0
        : !Array.isArray(body.ids) ||
          !body.ids.length ||
          body.ids.length > 30 ||
          body.ids.some(
            (id: unknown) =>
              typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
          )
    )
      throw new CalendarError(400, "Некорректные уведомления");
    const base = {
      userShow: { userId },
      episode: { airDate: { lte: dayDate(today) } },
    };
    if (
      !all &&
      (await prisma.releaseNotification.count({
        where: { ...base, id: { in: body.ids } },
      })) !== new Set(body.ids).size
    )
      throw new CalendarError(404, "Уведомление не найдено");
    const result = await prisma.releaseNotification.updateMany({
      where: {
        ...base,
        readAt: null,
        id: all ? { lte: body.throughId } : { in: body.ids },
      },
      data: { readAt: new Date() },
    });
    return privateJson({ success: true, updated: result.count });
  } catch (error) {
    return calendarFailure(error);
  }
}
