import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// Утилита: превращает BigInt в Number
function serializeShow(show: any) {
  if (!show) return show;
  return {
    ...show,
    budget: show.budget != null ? Number(show.budget) : null,
    revenue: show.revenue != null ? Number(show.revenue) : null,
  };
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { episode: "asc" }] },
      createdBy: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
        },
      },
      userShows: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true },
          },
          ratings: true,
        },
      },
    },
  });

  if (!show) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Мой UserShow (если есть)
  const myUserShow = show.userShows.find((us) => us.userId === me.id) || null;

  // Средняя оценка по всем пользователям
  const allRatings = show.userShows.flatMap((us) => us.ratings);
  const avgRating = allRatings.length
    ? allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length
    : null;

  return NextResponse.json({
    show: {
      id: show.id,
      name: show.name,
      originalName: show.originalName,
      description: show.description,
      posterUrl: show.posterUrl,
      kind: show.kind,
      tmdbId: show.tmdbId,
      year: show.year,
      releaseDate: show.releaseDate,
      runtime: show.runtime,
      budget: show.budget ? Number(show.budget) : null,
      revenue: show.revenue ? Number(show.revenue) : null,
      countries: show.countries,
      studios: show.studios,
      genres: show.genres,
      director: show.director,
      creators: show.creators,
      cast: show.cast,
      tmdbRating: show.tmdbRating,
      tmdbVotes: show.tmdbVotes,
      createdAt: show.createdAt,
      createdBy: show.createdBy,
    },
    episodes: show.episodes.map((e) => ({
      id: e.id,
      season: e.season,
      episode: e.episode,
    })),
    comments: show.comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      user: c.user,
      isOwn: c.userId === me.id,
    })),
    userShowsCount: show.userShows.length,
    userShows: show.userShows.map((us) => ({
      user: us.user,
      isFavorite: us.isFavorite,
      isCompleted: us.isCompleted,
      status: us.status, // ← новое
    })),
    avgRating,
    ratingsCount: allRatings.length,
    myUserShow: myUserShow
      ? {
          id: myUserShow.id,
          totalSeasons: myUserShow.totalSeasons,
          totalEpisodes: myUserShow.totalEpisodes,
          isCompleted: myUserShow.isCompleted,
          isFavorite: myUserShow.isFavorite,
          status: myUserShow.status, // ← новое
          dubbing: myUserShow.dubbing,
          watchSite: myUserShow.watchSite,
        }
      : null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (show.createdById !== me.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  for (const k of [
    "name",
    "originalName",
    "posterUrl",
    "description",
    "year",
    "director",
  ]) {
    if (k in body) data[k] = body[k] || null;
  }
  if ("genres" in body)
    data.genres = Array.isArray(body.genres) ? body.genres : [];
  if ("countries" in body)
    data.countries = Array.isArray(body.countries) ? body.countries : [];
  if ("studios" in body)
    data.studios = Array.isArray(body.studios) ? body.studios : [];

  const updated = await prisma.show.update({ where: { id }, data });
  return NextResponse.json(serializeShow(updated));
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (show.createdById !== me.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.show.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}