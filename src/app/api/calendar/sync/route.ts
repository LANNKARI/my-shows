import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  queryRange,
  CalendarError,
} from "@/lib/calendar-server";
import { scheduleDue, syncShowSchedule } from "@/lib/release-schedule";
export const maxDuration = 30;
export async function POST(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true),
      range = queryRange(request);
    const body = await request.json().catch(() => null);
    if (
      !body ||
      !Array.isArray(body.showIds) ||
      !body.showIds.length ||
      body.showIds.length > 2 ||
      body.showIds.some(
        (id: unknown) =>
          typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
      )
    )
      throw new CalendarError(400, "Некорректный список сериалов");
    const entries = await prisma.userShow.findMany({
      where: {
        userId,
        showId: { in: body.showIds },
        status: { in: ["watching", "planned", "completed"] },
        show: { kind: "series" },
      },
      include: { show: true },
    });
    if (
      new Set(entries.map((entry) => entry.showId)).size !==
      new Set(body.showIds).size
    )
      throw new CalendarError(404, "Сериал не найден в библиотеке");
    const results = await Promise.all(
      entries.map(async (entry) => ({
        showId: entry.showId,
        ...(!scheduleDue(entry.show, range.from, range.to)
          ? { ok: true, cached: true }
          : await syncShowSchedule(entry.show, range)),
      })),
    );
    return privateJson({ results });
  } catch (error) {
    return calendarFailure(error);
  }
}
