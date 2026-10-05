import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Ищем пользователя
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

  // Сериалы пользователя
  const titles = await prisma.title.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      ratings: true,
      episodes: { select: { watched: true } },
    },
  });

  // Коллекции
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

  // Статистика
  const allRatings = titles.flatMap((t) => t.ratings);
  const stats = {
    totalTitles: titles.length,
    completedTitles: titles.filter((t) => t.isCompleted).length,
    totalSeries: titles.filter((t) => t.kind === "series").length,
    totalMovies: titles.filter((t) => t.kind === "movie").length,
    avgRating:
      allRatings.length > 0
        ? allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length
        : null,
  };

  // Статус дружбы с текущим пользователем
  const me = await getCurrentUser();
  let friendshipStatus: "none" | "pending_out" | "pending_in" | "friends" | "self" =
    "none";
  let friendshipId: number | null = null;

  if (me) {
    if (me.id === user.id) {
      friendshipStatus = "self";
    } else {
      const f = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: me.id, addresseeId: user.id },
            { requesterId: user.id, addresseeId: me.id },
          ],
        },
      });
      if (f) {
        friendshipId = f.id;
        if (f.status === "accepted") friendshipStatus = "friends";
        else if (f.requesterId === me.id) friendshipStatus = "pending_out";
        else friendshipStatus = "pending_in";
      }
    }
  }

  return NextResponse.json({
    user,
    titles: titlesResult,
    collections,
    stats,
    friendshipStatus,
    friendshipId,
  });
}