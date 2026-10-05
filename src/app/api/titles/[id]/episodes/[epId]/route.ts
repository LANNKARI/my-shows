import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; epId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr, epId: epIdStr } = await params;
  const titleId = Number(idStr);
  const epId = Number(epIdStr);

  // Проверяем, что тайтл принадлежит пользователю
  const owned = await prisma.title.findFirst({
    where: { id: titleId, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if ("watched" in body) {
    data.watched = !!body.watched;
    data.watchedAt = body.watched ? new Date() : null;
  }
  if ("stoppedAt" in body) data.stoppedAt = body.stoppedAt || null;

  const ep = await prisma.episode.update({ where: { id: epId }, data });

  // Обновляем isCompleted
  const all = await prisma.episode.findMany({ where: { titleId } });
  const allWatched = all.length > 0 && all.every((e) => e.watched);
  await prisma.title.update({
    where: { id: titleId },
    data: { isCompleted: allWatched },
  });

  return NextResponse.json(ep);
}