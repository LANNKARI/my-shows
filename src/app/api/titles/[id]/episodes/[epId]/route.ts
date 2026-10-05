import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; epId: string }> }
) {
  const { id: idStr, epId: epIdStr } = await params;
  const titleId = Number(idStr);
  const epId = Number(epIdStr);
  const body = await req.json();

  const data: any = {};
  if ("watched" in body) {
    data.watched = !!body.watched;
    data.watchedAt = body.watched ? new Date() : null;
  }
  if ("stoppedAt" in body) data.stoppedAt = body.stoppedAt || null;

  const ep = await prisma.episode.update({ where: { id: epId }, data });

  const all = await prisma.episode.findMany({ where: { titleId } });
  const allWatched = all.length > 0 && all.every((e) => e.watched);
  await prisma.title.update({ where: { id: titleId }, data: { isCompleted: allWatched } });

  return NextResponse.json(ep);
}