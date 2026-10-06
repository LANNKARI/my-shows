import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// Утилита: превращает BigInt в Number для JSON
function serializeShow(show: any) {
  if (!show) return show;
  return {
    ...show,
    budget: show.budget != null ? Number(show.budget) : null,
    revenue: show.revenue != null ? Number(show.revenue) : null,
  };
}

// GET — список каталога
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";

  const shows = await prisma.show.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { originalName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: {
        select: {
          userShows: true,
          comments: true,
        },
      },
    },
  });

  const result = shows.map((s) => ({
    id: s.id,
    name: s.name,
    originalName: s.originalName,
    posterUrl: s.posterUrl,
    kind: s.kind,
    year: s.year,
    genres: s.genres,
    tmdbRating: s.tmdbRating,
    userShowsCount: s._count.userShows,
    commentsCount: s._count.comments,
  }));

  return NextResponse.json(result);
}

// POST — создать сериал в каталоге (или вернуть существующий)
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    originalName,
    posterUrl,
    kind,
    description,
    tmdbId,
    year,
    releaseDate,
    runtime,
    budget,
    revenue,
    countries,
    studios,
    genres,
    director,
    creators,
    cast,
    tmdbRating,
    tmdbVotes,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // 1. Если есть tmdbId — ищем по нему (самый надёжный способ)
  if (tmdbId) {
    const existing = await prisma.show.findFirst({
      where: { tmdbId: Number(tmdbId), kind: kind || "series" },
    });
    if (existing) {
      return NextResponse.json(serializeShow(existing));
    }
  }

  // 2. Иначе — ищем по имени + оригинальному имени
  const existingByName = await prisma.show.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      originalName: originalName
        ? { equals: originalName, mode: "insensitive" }
        : null,
      kind: kind || "series",
    },
  });
  if (existingByName) {
    return NextResponse.json(serializeShow(existingByName));
  }

  // 3. Создаём новый Show
  const show = await prisma.show.create({
    data: {
      name,
      originalName: originalName || null,
      posterUrl: posterUrl || null,
      kind: kind || "series",
      description: description || null,
      tmdbId: tmdbId ? Number(tmdbId) : null,
      year: year || null,
      releaseDate:
        releaseDate && !isNaN(new Date(releaseDate).getTime())
          ? new Date(releaseDate)
          : null,
      runtime: runtime ? Number(runtime) : null,
      budget:
        budget != null && !isNaN(Number(budget))
          ? BigInt(Math.round(Number(budget)))
          : null,
      revenue:
        revenue != null && !isNaN(Number(revenue))
          ? BigInt(Math.round(Number(revenue)))
          : null,
      countries: Array.isArray(countries)
        ? countries.filter((c: any) => typeof c === "string")
        : [],
      studios: Array.isArray(studios)
        ? studios.filter((s: any) => typeof s === "string")
        : [],
      genres: Array.isArray(genres)
        ? genres.filter((g: any) => typeof g === "string")
        : [],
      director: director || null,
      creators: Array.isArray(creators)
        ? creators.filter((c: any) => typeof c === "string")
        : [],
      cast: cast ? JSON.parse(JSON.stringify(cast)) : null,
      tmdbRating:
        tmdbRating != null && !isNaN(Number(tmdbRating))
          ? Number(tmdbRating)
          : null,
      tmdbVotes:
        tmdbVotes != null && !isNaN(Number(tmdbVotes))
          ? Number(tmdbVotes)
          : null,
      createdById: me.id,
    },
  });

  return NextResponse.json(serializeShow(show), { status: 201 });
}