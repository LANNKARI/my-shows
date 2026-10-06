import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") || "all";
  const genre = params.get("genre") || "";
  const yearFrom = Number(params.get("yearFrom")) || 0;
  const ratingFrom = Number(params.get("ratingFrom")) || 0;

  // Список Show, которые УЖЕ в моей библиотеке — исключим
  const myUserShows = await prisma.userShow.findMany({
    where: { userId: me.id },
    select: { showId: true },
  });
  const excludeIds = myUserShows.map((us) => us.showId);

  // Собираем фильтры
  const where: any = {};

  if (excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }

  if (kind === "series" || kind === "movie") {
    where.kind = kind;
  }

  if (genre) {
    where.genres = { has: genre };
  }

  if (yearFrom > 0) {
    where.year = { gte: String(yearFrom) };
  }

  if (ratingFrom > 0) {
    where.tmdbRating = { gte: ratingFrom };
  }

  // Считаем количество
  const count = await prisma.show.count({ where });

  if (count === 0) {
    return NextResponse.json({ error: "no_shows", count: 0 }, { status: 404 });
  }

  // Берём случайный offset
  const randomOffset = Math.floor(Math.random() * count);

  const [show] = await prisma.show.findMany({
    where,
    skip: randomOffset,
    take: 1,
    select: {
      id: true,
      name: true,
      originalName: true,
      description: true,
      posterUrl: true,
      kind: true,
      year: true,
      genres: true,
      countries: true,
      studios: true,
      director: true,
      creators: true,
      cast: true,
      tmdbRating: true,
      tmdbVotes: true,
      runtime: true,
      releaseDate: true,
    },
  });

  if (!show) {
    return NextResponse.json({ error: "no_shows" }, { status: 404 });
  }

  return NextResponse.json({
    ...show,
    totalMatching: count,
  });
}