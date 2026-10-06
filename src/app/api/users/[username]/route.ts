import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // ── Ищем пользователя с ПОЛНЫМИ данными ──
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

  // ── Сериалы пользователя через UserShow ──
  const userShows = await prisma.userShow.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      show: true,
      ratings: true,
      progress: { select: { watched: true } },
    },
  });

  // ── Коллекции ──
  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: {
      items: {
        include: { show: true },
      },
    },
    orderBy: { id: "desc" },
  });

  // ── Карточки для сетки ──
  const titlesResult = userShows.map((us) => ({
    id: us.show.id,
    userShowId: us.id,
    name: us.show.name,
    originalName: us.show.originalName,
    posterUrl: us.show.posterUrl,
    isCompleted: us.isCompleted,
    isFavorite: us.isFavorite,
    kind: us.show.kind,
    avgRating: us.ratings.length
      ? us.ratings.reduce((s, r) => s + r.score, 0) / us.ratings.length
      : null,
    watchedEpisodes: us.progress.filter((p) => p.watched).length,
    episodesCount: us.progress.length,
  }));

  // ── Любимые (топ-5) ──
  const favorites = titlesResult.filter((t) => t.isFavorite).slice(0, 5);

  // ── Статистика ──
  const allRatings = userShows.flatMap((us) => us.ratings);
  const stats = {
    totalTitles: userShows.length,
    completedTitles: userShows.filter((us) => us.isCompleted).length,
    totalSeries: userShows.filter((us) => us.show.kind === "series").length,
    totalMovies: userShows.filter((us) => us.show.kind === "movie").length,
    avgRating:
      allRatings.length > 0
        ? allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length
        : null,
  };

  // ── Статус дружбы ──
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
    favorites,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.filter((i) => i.show).map((i) => ({ id: i.id })),
    })),
    stats,
    friendshipStatus,
    friendshipId,
  });
}