import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// POST — создать эпизоды для Show (если их ещё нет)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const showId = Number(idStr);
    if (!showId) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const body = await req.json();
    const { episodesPerSeason } = body;

    console.log("[episodes POST] showId:", showId, "kind:", show.kind);
    console.log("[episodes POST] episodesPerSeason:", episodesPerSeason);

    // ── Определяем массив сезонов ──
    let seasonsArray: number[];
    if (!Array.isArray(episodesPerSeason)) {
      if (show.kind === "movie") {
        seasonsArray = [1];
      } else {
        return NextResponse.json(
          { error: "episodesPerSeason required" },
          { status: 400 }
        );
      }
    } else if (episodesPerSeason.length === 0 && show.kind === "movie") {
      seasonsArray = [1];
    } else {
      seasonsArray = episodesPerSeason;
    }

    // ── Проверяем, что эпизоды ещё не созданы ──
    const existingCount = await prisma.episode.count({ where: { showId } });
    if (existingCount > 0) {
      console.log("[episodes POST] episodes already exist:", existingCount);
      return NextResponse.json({
        ok: true,
        message: "episodes already exist",
        count: existingCount,
      });
    }

    // ── Защита от больших чисел ──
    const MAX_PER_SEASON = 200;
    const MAX_TOTAL = 5000;

    const eps: { showId: number; season: number; episode: number }[] = [];
    for (let s = 0; s < seasonsArray.length; s++) {
      const count = Math.min(
        Math.max(0, Number(seasonsArray[s]) || 0),
        MAX_PER_SEASON
      );
      for (let e = 1; e <= count; e++) {
        eps.push({ showId, season: s + 1, episode: e });
        if (eps.length >= MAX_TOTAL) break;
      }
      if (eps.length >= MAX_TOTAL) break;
    }

    console.log("[episodes POST] creating", eps.length, "episodes");

    if (eps.length > 0) {
      await prisma.episode.createMany({ data: eps });
      console.log("[episodes POST] episodes created:", eps.length);
    }

    return NextResponse.json({ ok: true, created: eps.length });
  } catch (err: any) {
    console.error("[episodes POST] Error:", err.message);
    console.error("[episodes POST] Stack:", err.stack);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}