import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// Вспомогательная: можно ли смотреть этот сериал
async function canViewTitle(titleId: number, meId: string) {
  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: { id: true, userId: true },
  });
  if (!title) return null;

  // Свой сериал — видим
  if (title.userId === meId) return { title, isOwner: true };

  // Чужой — только если друзья
  if (title.userId) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "accepted",
        OR: [
          { requesterId: meId, addresseeId: title.userId },
          { requesterId: title.userId, addresseeId: meId },
        ],
      },
    });
    if (friendship) return { title, isOwner: false };
  }

  return null;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const access = await canViewTitle(id, me.id);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });

  const title = await prisma.title.findUnique({
    where: { id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { episode: "asc" }] },
      ratings: true,
      collections: { include: { collection: true } },
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  if (!title) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    ...title,
    isOwner: access.isOwner,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await prisma.title.findFirst({
    where: { id, userId: me.id },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  for (const k of ["name", "originalName", "dubbing", "watchSite", "posterUrl", "kind"]) {
    if (k in body) data[k] = body[k] || null;
  }
  if ("totalSeasons" in body) data.totalSeasons = Number(body.totalSeasons) || 1;
  if ("totalEpisodes" in body) data.totalEpisodes = Number(body.totalEpisodes) || 0;
  if ("isCompleted" in body) data.isCompleted = !!body.isCompleted;

  const updated = await prisma.title.update({ where: { id }, data });
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

  const owned = await prisma.title.findFirst({
    where: { id, userId: me.id },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.title.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}