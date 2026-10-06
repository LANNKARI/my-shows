import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tmdbId = new URL(req.url).searchParams.get("id");
  const kind = new URL(req.url).searchParams.get("kind") || "series";

  if (!tmdbId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY не настроен" }, { status: 500 });
  }

  try {
    // Movie vs TV — разные эндпоинты
    const endpoint = kind === "movie" ? "movie" : "tv";
    const url =
      `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${apiKey}` +
      `&language=ru-RU&append_to_response=credits,external_ids`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("[TMDB details] Ошибка:", await res.text());
      return NextResponse.json({ error: "TMDB error" }, { status: 502 });
    }

    const data = await res.json();

    // ── Сезоны и серии (для сериалов) ──
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

    // ── Страны производства ──
    const countries = Array.isArray(data.production_countries)
      ? data.production_countries.map((c: any) => c.name).filter(Boolean)
      : [];

    // ── Студии ──
    const studios = Array.isArray(data.production_companies)
      ? data.production_companies.map((c: any) => c.name).filter(Boolean).slice(0, 5)
      : [];

    // ── Жанры ──
    const genres = Array.isArray(data.genres)
      ? data.genres.map((g: any) => g.name).filter(Boolean)
      : [];

    // ── Режиссёр (для фильмов) — из credits.crew ──
    let director: string | null = null;
    if (kind === "movie" && data.credits?.crew) {
      const dir = data.credits.crew.find((c: any) => c.job === "Director");
      director = dir?.name || null;
    }

    // ── Создатели (для сериалов) — created_by ──
    const creators = Array.isArray(data.created_by)
      ? data.created_by.map((c: any) => c.name).filter(Boolean)
      : [];

    // ── Актёры (топ-10) ──
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

    // ── Дополнительные метрики ──
    const runtime = kind === "movie"
      ? data.runtime || null
      : data.episode_run_time?.[0] || null;

    const releaseDate = kind === "movie"
      ? data.release_date || null
      : data.first_air_date || null;

    const year = releaseDate ? releaseDate.slice(0, 4) : null;

    const budget = kind === "movie" && data.budget ? data.budget : null;
    const revenue = kind === "movie" && data.revenue ? data.revenue : null;

    const tmdbRating = data.vote_average
      ? Math.round(data.vote_average * 10) / 10
      : null;
    const tmdbVotes = data.vote_count || null;

    return NextResponse.json({
      numberOfSeasons,
      numberOfEpisodes,
      episodesPerSeason,
      // Расширенные данные
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
    });
  } catch (e: any) {
    console.error("[TMDB details] Ошибка:", e.message);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}