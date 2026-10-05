import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

async function findOwnedTitle(id: number, userId: string) {
  return prisma.title.findFirst({ where: { id, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const title = await prisma.title.findFirst({
    where: { id, userId: user.id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { episode: "asc" }] },
      ratings: true,
      collections: { include: { collection: true } },
    },
  });
  if (!title) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(title);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await findOwnedTitle(id, user.id);
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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await findOwnedTitle(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.title.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}