import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const titles = await prisma.title.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      ratings: true,
      episodes: { select: { watched: true } },
    },
  });

  const result = titles.map((t) => ({
    id: t.id,
    name: t.name,
    originalName: t.originalName,
    dubbing: t.dubbing,
    watchSite: t.watchSite,
    totalSeasons: t.totalSeasons,
    totalEpisodes: t.totalEpisodes,
    posterUrl: t.posterUrl,
    isCompleted: t.isCompleted,
    kind: t.kind,
    avgRating: t.ratings.length
      ? t.ratings.reduce((s, r) => s + r.score, 0) / t.ratings.length
      : null,
    watchedEpisodes: t.episodes.filter((e) => e.watched).length,
    episodesCount: t.episodes.length,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();

  const {
    name,
    originalName,
    dubbing,
    watchSite,
    totalSeasons,
    totalEpisodes,
    posterUrl,
    kind,
  } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const title = await prisma.title.create({
    data: {
      name,
      originalName: originalName || null,
      dubbing: dubbing || null,
      watchSite: watchSite || null,
      totalSeasons: Number(totalSeasons) || 1,
      totalEpisodes: Number(totalEpisodes) || 0,
      posterUrl: posterUrl || null,
      kind: kind || "series",
      userId: user.id,
    },
  });

  if ((kind || "series") === "series" && Number(totalSeasons) > 0 && Number(totalEpisodes) > 0) {
    const perSeason = Math.ceil(Number(totalEpisodes) / Number(totalSeasons));
    const eps: { titleId: number; season: number; episode: number }[] = [];
    let remaining = Number(totalEpisodes);
    for (let s = 1; s <= Number(totalSeasons); s++) {
      const count = Math.min(perSeason, remaining);
      for (let e = 1; e <= count; e++) {
        eps.push({ titleId: title.id, season: s, episode: e });
      }
      remaining -= count;
    }
    if (eps.length) {
      await prisma.episode.createMany({ data: eps });
    }
  }

  return NextResponse.json(title, { status: 201 });
}