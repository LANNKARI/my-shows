import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import { hasPermission, isSiteOwner, audit } from "@/lib/account-access";
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams,
      manage = q.get("manage") === "1",
      search = q.get("q");
    let userId: string | undefined,
      owner = false;
    if (manage || search) {
      userId = await calendarUser(req);
      if (!(await hasPermission(userId, "curate")))
        throw new CalendarError(403, "Нужна роль куратора");
      owner = await isSiteOwner(userId);
    }
    if (search) {
      if (search.length < 2 || search.length > 100)
        throw new CalendarError(400, "Введите от 2 до 100 символов");
      return privateJson({
        shows: await prisma.show.findMany({
          where: { name: { contains: search, mode: "insensitive" } },
          select: { id: true, name: true, posterUrl: true, kind: true },
          take: 12,
          orderBy: { name: "asc" },
        }),
      });
    }
    const offset = Number(q.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new CalendarError(400, "Некорректная страница");
    const rows = await prisma.editorialPick.findMany({
      where: manage ? (owner ? {} : { userId }) : { published: true },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: 21,
    });
    const ids = [...new Set(rows.flatMap((r) => r.showIds))];
    const shows = await prisma.show.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, posterUrl: true, kind: true },
      }),
      map = new Map(shows.map((s) => [s.id, s]));
    return privateJson({
      items: rows
        .slice(0, 20)
        .map((r) => ({
          ...r,
          shows: r.showIds.map((id) => map.get(id)).filter(Boolean),
        })),
      hasMore: rows.length > 20,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const userId = await calendarUser(req, true);
    const b = await req.json().catch(() => null);
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).some(
        (k) =>
          !["id", "name", "description", "showIds", "published"].includes(k),
      ) ||
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 100 ||
      typeof b.description !== "string" ||
      b.description.length > 1000 ||
      !Array.isArray(b.showIds) ||
      b.showIds.length < 1 ||
      b.showIds.length > 50 ||
      b.showIds.some(
        (i: unknown) =>
          typeof i !== "number" || !Number.isSafeInteger(i) || i < 1,
      ) ||
      new Set(b.showIds).size !== b.showIds.length ||
      typeof b.published !== "boolean" ||
      (b.id !== null && typeof b.id !== "string")
    )
      throw new CalendarError(400, "Проверьте название и список тайтлов");
    await prisma.$transaction(async (tx) => {
      if (!(await hasPermission(userId, "curate", tx)))
        throw new CalendarError(403, "Нужна роль куратора");
      if (
        (await tx.show.count({ where: { id: { in: b.showIds } } })) !==
        b.showIds.length
      )
        throw new CalendarError(400, "Один из тайтлов недоступен");
      const data = {
        name: b.name.trim(),
        description: b.description.trim(),
        showIds: b.showIds,
        published: b.published,
      };
      if (b.id) {
        const old = await tx.editorialPick.findUnique({ where: { id: b.id } });
        if (!old || (old.userId !== userId && !(await isSiteOwner(userId, tx))))
          throw new CalendarError(403, "Нельзя изменить чужую подборку");
        await tx.editorialPick.update({ where: { id: b.id }, data });
        await audit(tx, userId, "pickUpdate", b.id, { published: b.published });
      } else {
        const row = await tx.editorialPick.create({
          data: { userId, ...data },
        });
        await audit(tx, userId, "pickCreate", row.id, {
          published: b.published,
        });
      }
    });
    return privateJson({ success: true });
  } catch (e) {
    return calendarFailure(e);
  }
}
