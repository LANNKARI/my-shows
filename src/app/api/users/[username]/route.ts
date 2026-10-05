import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const titles = await prisma.title.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      ratings: true,
      episodes: { select: { watched: true } },
    },
  });

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { id: "desc" },
  });

  const titlesResult = titles.map((t) => ({
    id: t.id,
    name: t.name,
    originalName: t.originalName,
    dubbing: t.dubbing,
    posterUrl: t.posterUrl,
    isCompleted: t.isCompleted,
    kind: t.kind,
    avgRating: t.ratings.length
      ? t.ratings.reduce((s, r) => s + r.score, 0) / t.ratings.length
      : null,
    watchedEpisodes: t.episodes.filter((e) => e.watched).length,
    episodesCount: t.episodes.length,
  }));

  const stats = {
    totalTitles: titles.length,
    completedTitles: titles.filter((t) => t.isCompleted).length,
    totalSeries: titles.filter((t) => t.kind === "series").length,
    totalMovies: titles.filter((t) => t.kind === "movie").length,
    avgRating:
      titles.flatMap((t) => t.ratings).length > 0
        ? titles.flatMap((t) => t.ratings).reduce((s, r) => s + r.score, 0) /
          titles.flatMap((t) => t.ratings).length
        : null,
  };

  return NextResponse.json({
    user,
    titles: titlesResult,
    collections,
    stats,
  });
}