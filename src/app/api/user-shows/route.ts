import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// ────────────────────────────────────────────────
// Утилита: превращает BigInt в Number для JSON
// ────────────────────────────────────────────────
function serializeUserShow(us: any) {
  if (!us) return us;
  const result: any = {
    ...us,
  };
  if (us.show) {
    result.show = {
      ...us.show,
      budget: us.show.budget != null ? Number(us.show.budget) : null,
      revenue: us.show.revenue != null ? Number(us.show.revenue) : null,
    };
  }
  return result;
}

// ────────────────────────────────────────────────
// GET — моя библиотека
// ────────────────────────────────────────────────
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

// ────────────────────────────────────────────────
// POST — добавить Show в мою библиотеку
// ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { showId, totalSeasons, totalEpisodes, dubbing, watchSite } = body;

    console.log("[user-shows POST] body:", body);

    if (!showId) {
      return NextResponse.json({ error: "showId required" }, { status: 400 });
    }

    // Проверяем, что Show существует
    const show = await prisma.show.findUnique({
      where: { id: Number(showId) },
    });
    console.log("[user-shows POST] show found:", !!show);
    if (!show) {
      return NextResponse.json({ error: "show not found" }, { status: 404 });
    }

    // Проверяем, нет ли уже UserShow
    const existing = await prisma.userShow.findFirst({
      where: { userId: me.id, showId: Number(showId) },
    });
    console.log("[user-shows POST] existing:", !!existing);

    if (existing) {
      return NextResponse.json(serializeUserShow(existing));
    }

    // Создаём UserShow
    const userShow = await prisma.userShow.create({
      data: {
        userId: me.id,
        showId: Number(showId),
        kind: show.kind || "series",
        totalSeasons: Number(totalSeasons) || 1,
        totalEpisodes: Number(totalEpisodes) || 0,
        dubbing: dubbing || null,
        watchSite: watchSite || null,
      },
      include: { show: true },
    });
    console.log("[user-shows POST] userShow created:", userShow.id);

    // Создаём EpisodeProgress для всех эпизодов Show
    const episodes = await prisma.episode.findMany({
      where: { showId: show.id },
    });
    console.log("[user-shows POST] episodes found:", episodes.length);

    if (episodes.length > 0) {
      await prisma.episodeProgress.createMany({
        data: episodes.map((e) => ({
          userShowId: userShow.id,
          episodeId: e.id,
          watched: false,
        })),
      });
      console.log(
        "[user-shows POST] progress created for",
        episodes.length,
        "episodes"
      );
    }

    return NextResponse.json(serializeUserShow(userShow), { status: 201 });
  } catch (err: any) {
    console.error("[user-shows POST] Error:", err.message);
    console.error("[user-shows POST] Stack:", err.stack);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}