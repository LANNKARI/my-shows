import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ── Профиль ──
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // ── Мои сериалы (UserShow) ──
  const userShows = await prisma.userShow.findMany({
    where: { userId: me.id },
    include: {
      show: true,
      ratings: true,
      progress: {
        include: { episode: true },
      },
    },
  });

  // ── Мои коллекции ──
  const collections = await prisma.collection.findMany({
    where: { userId: me.id },
    include: {
      items: {
        include: { show: true },
      },
    },
  });

  // ── Мои комментарии ──
  const comments = await prisma.comment.findMany({
    where: { userId: me.id },
    include: {
      show: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Мои друзья ──
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: me.id }, { addresseeId: me.id }],
    },
    include: {
      requester: { select: { username: true, name: true } },
      addressee: { select: { username: true, name: true } },
    },
  });

  const friends = friendships.map((f) =>
    f.requesterId === me.id ? f.addressee : f.requester
  );

  // ── Собираем JSON ──
  const backup = {
    meta: {
      version: 1,
      generator: "EpisyHub",
      exportedAt: new Date().toISOString(),
      user: user.username,
    },
    user,
    stats: {
      userShowsCount: userShows.length,
      collectionsCount: collections.length,
      commentsCount: comments.length,
      friendsCount: friends.length,
      totalWatchedEpisodes: userShows.reduce(
        (sum, us) => sum + us.progress.filter((p) => p.watched).length,
        0
      ),
    },
    userShows: userShows.map((us) => ({
      show: {
        id: us.show.id,
        name: us.show.name,
        originalName: us.show.originalName,
        posterUrl: us.show.posterUrl,
        kind: us.show.kind,
        tmdbId: us.show.tmdbId,
        year: us.show.year,
        genres: us.show.genres,
      },
      settings: {
        totalSeasons: us.totalSeasons,
        totalEpisodes: us.totalEpisodes,
        isCompleted: us.isCompleted,
        isFavorite: us.isFavorite,
        dubbing: us.dubbing,
        watchSite: us.watchSite,
      },
      ratings: us.ratings.map((r) => ({
        score: r.score,
        episodeId: r.episodeId,
        createdAt: r.createdAt,
      })),
      progress: us.progress.map((p) => ({
        season: p.episode.season,
        episode: p.episode.episode,
        watched: p.watched,
        stoppedAt: p.stoppedAt,
        watchedAt: p.watchedAt,
      })),
    })),
    collections: collections.map((c) => ({
      name: c.name,
      items: c.items.map((i) => ({
        showId: i.show?.id,
        showName: i.show?.name,
      })),
    })),
    comments: comments.map((c) => ({
      showId: c.show?.id,
      showName: c.show?.name,
      text: c.text,
      createdAt: c.createdAt,
    })),
    friends: friends.map((f) => ({
      username: f.username,
      name: f.name,
    })),
  };

  // ── Формируем имя файла ──
  const today = new Date().toISOString().slice(0, 10);
  const filename = `episyhub-backup-${user.username}-${today}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}