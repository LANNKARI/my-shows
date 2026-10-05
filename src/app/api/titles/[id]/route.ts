import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const title = await prisma.title.findUnique({
    where: { id },
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
  const { id: idStr } = await params;
  const id = Number(idStr);
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
  const { id: idStr } = await params;
  const id = Number(idStr);
  await prisma.title.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}