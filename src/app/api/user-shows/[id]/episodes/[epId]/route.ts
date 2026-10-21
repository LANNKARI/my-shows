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
  if (!Number.isSafeInteger(userShowId) || userShowId <= 0 || !Number.isSafeInteger(progressId) || progressId <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  // Проверяем, что UserShow — мой
  const userShow = await prisma.userShow.findFirst({
    where: { id: userShowId, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: { watched?: boolean; watchedAt?: Date | null; stoppedAt?: string | null } = {};
  if ("watched" in body) {
    if (typeof body.watched !== 'boolean') return NextResponse.json({ error: 'invalid watched' }, { status: 400 });
    data.watched = !!body.watched;
    data.watchedAt = body.watched ? new Date() : null;
  }
  if ("stoppedAt" in body) data.stoppedAt = body.stoppedAt || null;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.episodeProgress.updateMany({
      where: { id: progressId, userShowId }, data,
    });
    if (!result.count) return null;
    const all = await tx.episodeProgress.findMany({ where: { userShowId } });
    const allWatched = all.length > 0 && all.every((e) => e.watched);
    await tx.userShow.update({
      where: { id: userShowId },
      data: { isCompleted: allWatched, status: allWatched ? 'completed' : userShow.status === 'completed' ? 'watching' : userShow.status },
    });
    return tx.episodeProgress.findUnique({ where: { id: progressId } });
  });
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json(updated);
}
