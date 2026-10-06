import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// GET — моя библиотека
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userShows = await prisma.userShow.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: "desc" },
    include: {
      show: true,
      ratings: true,
      progress: { select: { watched: true } },
    },
  });

  const result = userShows.map((us) => ({
    id: us.id,
    show: {
      id: us.show.id,
      name: us.show.name,
      originalName: us.show.originalName,
      posterUrl: us.show.posterUrl,
      kind: us.show.kind,
      year: us.show.year,
      tmdbRating: us.show.tmdbRating,
    },
    totalSeasons: us.totalSeasons,
    totalEpisodes: us.totalEpisodes,
    isCompleted: us.isCompleted,
    isFavorite: us.isFavorite,
    dubbing: us.dubbing,
    watchSite: us.watchSite,
    watchedEpisodes: us.progress.filter((p) => p.watched).length,
    episodesCount: us.progress.length,
    avgRating: us.ratings.length
      ? us.ratings.reduce((s, r) => s + r.score, 0) / us.ratings.length
      : null,
  }));

  return NextResponse.json(result);
}

// POST — добавить Show в мою библиотеку
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { showId, totalSeasons, totalEpisodes, dubbing, watchSite } = body;

  if (!showId) return NextResponse.json({ error: "showId required" }, { status: 400 });

  // Проверяем, что Show существует
  const show = await prisma.show.findUnique({ where: { id: Number(showId) } });
  if (!show) return NextResponse.json({ error: "show not found" }, { status: 404 });

  // Проверяем, нет ли уже UserShow
  const existing = await prisma.userShow.findFirst({
    where: { userId: me.id, showId: Number(showId) },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  // Создаём UserShow
  const userShow = await prisma.userShow.create({
    data: {
      userId: me.id,
      showId: Number(showId),
      kind: show.kind,
      totalSeasons: Number(totalSeasons) || 1,
      totalEpisodes: Number(totalEpisodes) || 0,
      dubbing: dubbing || null,
      watchSite: watchSite || null,
    },
  });

  // Создаём EpisodeProgress для всех эпизодов Show
  const episodes = await prisma.episode.findMany({ where: { showId: show.id } });
  if (episodes.length > 0) {
    await prisma.episodeProgress.createMany({
      data: episodes.map((e) => ({
        userShowId: userShow.id,
        episodeId: e.id,
        watched: false,
      })),
    });
  }

  return NextResponse.json(userShow, { status: 201 });
}