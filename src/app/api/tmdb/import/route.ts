import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

export const runtime = "nodejs";

// Утилита: получает детали из TMDB
async function fetchDetails(tmdbId: number, kind: string, apiKey: string) {
  const endpoint = kind === "movie" ? "movie" : "tv";
  const url =
    `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${apiKey}` +
    `&language=ru-RU&append_to_response=credits,external_ids`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("TMDB details error");
  return await res.json();
}

// Утилита: скачивает постер в Cloudinary
async function uploadToCloudinary(posterUrl: string) {
  const { v2: cloudinary } = await import("cloudinary");

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const result: any = await cloudinary.uploader.upload(posterUrl, {
    folder: "my-shows",
    resource_type: "image",
    transformation: [
      { width: 600, height: 900, crop: "limit" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
  });

  return result.secure_url as string;
}

// Приводим результат к нужному виду
function parseDetails(data: any, kind: string) {
  // Сезоны и серии
  let episodesPerSeason: number[] = [];
  let numberOfSeasons = 1;
  let numberOfEpisodes = 0;

  if (kind === "series") {
    numberOfSeasons = data.number_of_seasons || 1;
    numberOfEpisodes = data.number_of_episodes || 0;

    const seasons = Array.isArray(data.seasons) ? data.seasons : [];
    const realSeasons = seasons
      .filter((s: any) => s.season_number > 0)
      .sort((a: any, b: any) => a.season_number - b.season_number);

    episodesPerSeason = realSeasons.map((s: any) => s.episode_count || 0);

    if (episodesPerSeason.length === 0 && numberOfEpisodes > 0) {
      const base = Math.floor(numberOfEpisodes / numberOfSeasons);
      const extra = numberOfEpisodes % numberOfSeasons;
      for (let i = 0; i < numberOfSeasons; i++) {
        episodesPerSeason.push(base + (i < extra ? 1 : 0));
      }
    }
  } else {
    numberOfSeasons = 1;
    numberOfEpisodes = 1;
    episodesPerSeason = [1];
  }

  const countries = Array.isArray(data.production_countries)
    ? data.production_countries.map((c: any) => c.name).filter(Boolean)
    : [];

  const studios = Array.isArray(data.production_companies)
    ? data.production_companies
        .map((c: any) => c.name)
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const genres = Array.isArray(data.genres)
    ? data.genres.map((g: any) => g.name).filter(Boolean)
    : [];

  let director: string | null = null;
  if (kind === "movie" && data.credits?.crew) {
    const dir = data.credits.crew.find((c: any) => c.job === "Director");
    director = dir?.name || null;
  }

  const creators = Array.isArray(data.created_by)
    ? data.created_by.map((c: any) => c.name).filter(Boolean)
    : [];

  const cast = Array.isArray(data.credits?.cast)
    ? data.credits.cast.slice(0, 10).map((a: any) => ({
        id: a.id,
        name: a.name,
        character: a.character || null,
        photoUrl: a.profile_path
          ? `https://image.tmdb.org/t/p/w185${a.profile_path}`
          : null,
      }))
    : [];

  const runtime =
    kind === "movie"
      ? data.runtime || null
      : data.episode_run_time?.[0] || null;

  const releaseDate =
    kind === "movie" ? data.release_date || null : data.first_air_date || null;

  const year = releaseDate ? releaseDate.slice(0, 4) : null;

  const budget = kind === "movie" && data.budget ? data.budget : null;
  const revenue = kind === "movie" && data.revenue ? data.revenue : null;

  const tmdbRating = data.vote_average
    ? Math.round(data.vote_average * 10) / 10
    : null;
  const tmdbVotes = data.vote_count || null;

  return {
    numberOfSeasons,
    numberOfEpisodes,
    episodesPerSeason,
    description: data.overview || null,
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
  };
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, kind, status } = body;

    if (!tmdbId || !kind) {
      return NextResponse.json(
        { error: "tmdbId and kind required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB_API_KEY не настроен" },
        { status: 500 }
      );
    }

    const finalKind = kind === "movie" ? "movie" : "series";
    const numTmdbId = Number(tmdbId);

    // ── 1. Ищем существующий Show по tmdbId ──
    let show = await prisma.show.findFirst({
      where: { tmdbId: numTmdbId, kind: finalKind },
    });

    let isNew = false;

    // ── 2. Если не нашли — тянем из TMDB и создаём ──
    if (!show) {
      const details = await fetchDetails(numTmdbId, finalKind, apiKey);
      const parsed = parseDetails(details, finalKind);

      // Ищем по name + originalName
      const name = details.name || details.title || "Без названия";
      const originalName =
        details.original_name || details.original_title || null;

      const existingByName = await prisma.show.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          kind: finalKind,
        },
      });

      if (existingByName) {
        show = existingByName;
      } else {
        // Скачиваем постер в Cloudinary
        let posterUrl: string | null = null;
        if (details.poster_path) {
          try {
            posterUrl = await uploadToCloudinary(
              `${TMDB_IMG}${details.poster_path}`
            );
          } catch (e) {
            console.error("[tmdb/import] poster upload failed:", e);
            posterUrl = null;
          }
        }

        // Создаём Show
        show = await prisma.show.create({
          data: {
            name,
            originalName,
            posterUrl,
            kind: finalKind,
            description: parsed.description,
            tmdbId: numTmdbId,
            year: parsed.year,
            releaseDate:
              parsed.releaseDate &&
              !isNaN(new Date(parsed.releaseDate).getTime())
                ? new Date(parsed.releaseDate)
                : null,
            runtime: parsed.runtime,
            budget:
              parsed.budget != null && !isNaN(Number(parsed.budget))
                ? BigInt(Math.round(Number(parsed.budget)))
                : null,
            revenue:
              parsed.revenue != null && !isNaN(Number(parsed.revenue))
                ? BigInt(Math.round(Number(parsed.revenue)))
                : null,
            countries: parsed.countries,
            studios: parsed.studios,
            genres: parsed.genres,
            director: parsed.director,
            creators: parsed.creators,
            cast: parsed.cast ? JSON.parse(JSON.stringify(parsed.cast)) : null,
            tmdbRating: parsed.tmdbRating,
            tmdbVotes: parsed.tmdbVotes,
            createdById: me.id,
          },
        });
        isNew = true;

        // Создаём эпизоды
        if (parsed.episodesPerSeason.length > 0) {
          const eps: { showId: number; season: number; episode: number }[] = [];
          for (let s = 0; s < parsed.episodesPerSeason.length; s++) {
            const count = Math.min(
              Math.max(0, Number(parsed.episodesPerSeason[s]) || 0),
              200
            );
            for (let e = 1; e <= count; e++) {
              eps.push({ showId: show.id, season: s + 1, episode: e });
            }
          }
          if (eps.length > 0) {
            await prisma.episode.createMany({ data: eps });
          }
        }
      }
    }

    // ── 3. Создаём/обновляем UserShow ──
    const finalStatus =
      status === "wishlist"
        ? "wishlist"
        : status === "completed"
        ? "completed"
        : "watching";

    let userShow = await prisma.userShow.findFirst({
      where: { userId: me.id, showId: show.id },
    });

    if (userShow) {
      // Если уже есть — обновляем статус, если он другой
      if (userShow.status !== finalStatus) {
        userShow = await prisma.userShow.update({
          where: { id: userShow.id },
          data: {
            status: finalStatus,
            isCompleted: finalStatus === "completed" ? true : userShow.isCompleted,
          },
        });
      }
    } else {
      userShow = await prisma.userShow.create({
        data: {
          userId: me.id,
          showId: show.id,
          kind: finalKind,
          status: finalStatus,
          isCompleted: finalStatus === "completed",
        },
      });

      // Создаём прогресс для эпизодов
      const episodes = await prisma.episode.findMany({
        where: { showId: show.id },
      });
      if (episodes.length > 0) {
        await prisma.episodeProgress.createMany({
          data: episodes.map((e) => ({
            userShowId: userShow!.id,
            episodeId: e.id,
            watched: false,
          })),
        });
      }
    }

    return NextResponse.json(
      {
        showId: show.id,
        userShowId: userShow.id,
        isNewShow: isNew,
      },
      { status: isNew ? 201 : 200 }
    );
  } catch (err: any) {
    console.error("[tmdb/import] Error:", err.message);
    console.error("[tmdb/import] Stack:", err.stack);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}