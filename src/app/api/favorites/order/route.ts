import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarUser, calendarFailure, CalendarError, privateJson } from "@/lib/calendar-server";
import { sortFavorites } from "@/lib/favorites";
function validIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(id => Number.isSafeInteger(id) && id > 0) && new Set(value).size === value.length;
}
export async function PATCH(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Object.keys(body).some(key => !["ids", "previousIds"].includes(key)) || !validIds(body.ids) || !validIds(body.previousIds)) throw new CalendarError(400, "Некорректный порядок тайтлов");
    const ids: number[] = body.ids, previousIds: number[] = body.previousIds;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const rows = await tx.$queryRaw<{ id: number; favoriteOrder: number | null; updatedAt: Date }[]>`SELECT id, "favoriteOrder", "updatedAt" FROM "UserShow" WHERE "userId" = ${userId} AND "isFavorite" = true ORDER BY id FOR UPDATE`;
      const current = sortFavorites(rows).map(row => row.id);
      const members = new Set(current);
      if (current.length !== ids.length || ids.some(id => !members.has(id)) || current.length !== previousIds.length || current.some((id, index) => id !== previousIds[index])) throw new CalendarError(409, "Список любимых изменился. Обновите его и повторите изменение порядка.");
      // Update only positions, preserving library updatedAt and viewing progress.
      await tx.$executeRaw`UPDATE "UserShow" AS us SET "favoriteOrder" = ordered.position::integer FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) WITH ORDINALITY AS ordered(id, position) WHERE us.id = ordered.id::integer AND us."userId" = ${userId} AND us."isFavorite" = true`;
    });
    return privateJson({ success: true });
  } catch (error) { return calendarFailure(error); }
}
