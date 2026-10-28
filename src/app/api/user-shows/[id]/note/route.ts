import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
async function context(
  request: NextRequest,
  params: Promise<{ id: string }>,
  write = false,
) {
  const userId = await calendarUser(request, write);
  const showId = Number((await params).id);
  if (!Number.isSafeInteger(showId) || showId <= 0)
    throw new CalendarError(400, "Некорректный тайтл");
  if (
    !(await prisma.userShow.findUnique({
      where: { userId_showId: { userId, showId } },
      select: { id: true },
    }))
  )
    throw new CalendarError(404, "Тайтл не найден в вашей библиотеке");
  return { userId, showId };
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await context(request, params);
    const note = await prisma.personalNote.findUnique({
      where: { userId_showId: key },
    });
    return privateJson({
      text: note?.text || "",
      updatedAt: note?.updatedAt || null,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const key = await context(request, params, true);
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.text !== "string" ||
      body.text.length > 2000 ||
      Object.keys(body).some((k) => k !== "text")
    )
      throw new CalendarError(400, "Заметка: не более 2000 символов");
    const note = await prisma.personalNote.upsert({
      where: { userId_showId: key },
      create: { ...key, text: body.text },
      update: { text: body.text },
    });
    return privateJson({ text: note.text, updatedAt: note.updatedAt });
  } catch (e) {
    return calendarFailure(e);
  }
}
