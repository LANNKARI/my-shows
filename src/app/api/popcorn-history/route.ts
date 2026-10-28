import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request),
      cursor = request.nextUrl.searchParams.get("cursor");
    if (
      cursor &&
      (cursor.length > 100 ||
        !(await prisma.popcornEntry.findFirst({
          where: { id: cursor, userId },
          select: { id: true },
        })))
    )
      throw new CalendarError(400, "Некорректная страница");
    const rows = await prisma.popcornEntry.findMany({
      where: { userId, category: { notIn: ["legacy", "game-event"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, amount: true, reason: true, createdAt: true },
    });
    return privateJson({
      items: rows.slice(0, 20),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
