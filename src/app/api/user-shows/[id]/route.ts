import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id, userId: me.id },
    include: {
      show: true,
      progress: {
        orderBy: [{ episode: { season: "asc" } }, { episode: { episode: "asc" } }],
        include: { episode: true },
      },
      ratings: true,
    },
  });

  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(userShow);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  for (const k of ["dubbing", "watchSite"]) {
    if (k in body) data[k] = body[k] || null;
  }
  if ("isCompleted" in body) data.isCompleted = !!body.isCompleted;
  if ("isFavorite" in body) data.isFavorite = !!body.isFavorite;
  if ("totalSeasons" in body) data.totalSeasons = Number(body.totalSeasons) || 1;
  if ("totalEpisodes" in body) data.totalEpisodes = Number(body.totalEpisodes) || 0;

  const updated = await prisma.userShow.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.userShow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}