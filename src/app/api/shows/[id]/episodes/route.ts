import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// POST — создать эпизоды для Show (если их ещё нет)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const showId = Number(idStr);
  if (!showId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const { episodesPerSeason } = body;

  if (!Array.isArray(episodesPerSeason)) {
    return NextResponse.json({ error: "episodesPerSeason required" }, { status: 400 });
  }

  // Проверяем, что эпизоды ещё не созданы
  const existingCount = await prisma.episode.count({ where: { showId } });
  if (existingCount > 0) {
    return NextResponse.json({ ok: true, message: "episodes already exist" });
  }

  // Создаём эпизоды
  const eps: { showId: number; season: number; episode: number }[] = [];
  for (let s = 0; s < episodesPerSeason.length; s++) {
    const count = Number(episodesPerSeason[s]) || 0;
    for (let e = 1; e <= count; e++) {
      eps.push({ showId, season: s + 1, episode: e });
    }
  }

  if (eps.length > 0) {
    await prisma.episode.createMany({ data: eps });
  }

  return NextResponse.json({ ok: true, created: eps.length });
}