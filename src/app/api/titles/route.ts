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
    episodesPerSeason, // ← новый массив: [10, 8, 12]
    posterUrl,
    kind,
  } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const seasons = Math.max(1, Number(totalSeasons) || 1);
  const finalKind = kind || "series";

  // Если пришёл массив — используем его. Если нет — старое поведение.
  let distribution: number[] = [];
  if (Array.isArray(episodesPerSeason) && episodesPerSeason.length > 0) {
    distribution = episodesPerSeason.slice(0, seasons).map((n) => Math.max(0, Number(n) || 0));
    // Дополняем нулями, если меньше сезонов указано
    while (distribution.length < seasons) distribution.push(0);
  } else {
    // Старое равномерное распределение (на случай, если массив не пришёл)
    const total = Math.max(0, Number(totalEpisodes) || 0);
    const base = Math.floor(total / seasons);
    const extra = total % seasons;
    distribution = Array.from({ length: seasons }, (_, i) => base + (i < extra ? 1 : 0));
  }

  const finalTotal = distribution.reduce((s, n) => s + n, 0);

  const title = await prisma.title.create({
    data: {
      name,
      originalName: originalName || null,
      dubbing: dubbing || null,
      watchSite: watchSite || null,
      totalSeasons: seasons,
      totalEpisodes: finalTotal,
      posterUrl: posterUrl || null,
      kind: finalKind,
      userId: user.id,
    },
  });

  // Создаём серии по распределению
  if (finalKind === "series") {
    const eps: { titleId: number; season: number; episode: number }[] = [];
    for (let s = 1; s <= seasons; s++) {
      const count = distribution[s - 1] || 0;
      for (let e = 1; e <= count; e++) {
        eps.push({ titleId: title.id, season: s, episode: e });
      }
    }
    if (eps.length) {
      await prisma.episode.createMany({ data: eps });
    }
  }

  return NextResponse.json(title, { status: 201 });
}