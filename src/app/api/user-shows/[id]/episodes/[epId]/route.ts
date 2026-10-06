import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; epId: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr, epId: epIdStr } = await params;
  const userShowId = Number(idStr);
  const progressId = Number(epIdStr);

  // Проверяем, что UserShow — мой
  const userShow = await prisma.userShow.findFirst({
    where: { id: userShowId, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if ("watched" in body) {
    data.watched = !!body.watched;
    data.watchedAt = body.watched ? new Date() : null;
  }
  if ("stoppedAt" in body) data.stoppedAt = body.stoppedAt || null;

  const updated = await prisma.episodeProgress.update({
    where: { id: progressId },
    data,
  });

  // Обновляем isCompleted
  const all = await prisma.episodeProgress.findMany({
    where: { userShowId },
  });
  const allWatched = all.length > 0 && all.every((e) => e.watched);
  await prisma.userShow.update({
    where: { id: userShowId },
    data: { isCompleted: allWatched },
  });

  return NextResponse.json(updated);
}