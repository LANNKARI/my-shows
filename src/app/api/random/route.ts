import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const MOVIE_GENRE_IDS: Record<string, number> = {
  боевик: 28, приключения: 12, мультфильм: 16, комедия: 35,
  криминал: 80, документальный: 99, драма: 18, семейный: 10751,
  фэнтези: 14, история: 36, ужасы: 27, музыка: 10402,
  детектив: 9648, романтика: 10749, фантастика: 878,
  триллер: 53, военный: 10752, вестерн: 37,
};

const TV_GENRE_IDS: Record<string, number> = {
  боевик: 10759, приключения: 10759, мультфильм: 16, комедия: 35,
  криминал: 80, документальный: 99, драма: 18, семейный: 10751,
  фэнтези: 10765, детектив: 9648, фантастика: 10765,
  военный: 10768, вестерн: 37,
};

const GENRE_ID_TO_EN: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
  53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News",
  10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
  10767: "Talk", 10768: "War & Politics",
};

async function fetchDiscover(
  apiKey: string,
  kind: "series" | "movie",
  genreIds: number[],
  yearFrom: number,
  ratingFrom: number,
  page: number
): Promise<{ results: any[]; total: number }> {
  const endpoint = kind === "movie" ? "movie" : "tv";

  const query = new URLSearchParams();
  query.set("api_key", apiKey);
  query.set("language", "ru-RU");
  query.set("sort_by", "popularity.desc");
  query.set("include_adult", "false");
  query.set("vote_count.gte", "10"); // снижено
  query.set("page", String(page));

  if (ratingFrom > 0) {
    query.set("vote_average.gte", String(ratingFrom));
  }

  if (yearFrom > 0) {
    if (kind === "movie") {
      query.set("primary_release_date.gte", `${yearFrom}-01-01`);
    } else {
      query.set("first_air_date.gte", `${yearFrom}-01-01`);
    }
  }

  // OR: жанры через запятую — фильм с ЛЮБЫМ из них
  if (genreIds.length > 0) {
    query.set("with_genres", genreIds.join(","));
  }

  const url = `${TMDB_BASE}/discover/${endpoint}?${query.toString()}`;
  console.log("[random] TMDB URL:", url.replace(apiKey, "***"));

  const res = await fetch(url, { cache: "no-store" });
  console.log("[random] TMDB status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("[random] TMDB error body:", text.slice(0, 300));
    return { results: [], total: 0 };
  }

  const data = await res.json();
  return {
    results: data.results || [],
    total: data.total_results || 0,
  };
}

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY не настроен" },
      { status: 500 }
    );
  }

  const params = new URL(req.url).searchParams;
  let kind = params.get("kind") || "all";
  const genreParam = (params.get("genre") || "").trim();
  const yearFrom = Number(params.get("yearFrom")) || 0;
  const ratingFrom = Number(params.get("ratingFrom")) || 0;

  const selectedGenres = genreParam
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  if (kind === "all") {
    kind = Math.random() < 0.5 ? "series" : "movie";
  }
  const finalKind: "series" | "movie" = kind === "movie" ? "movie" : "series";

  // Преобразуем жанры в ID
  const genreMap = finalKind === "movie" ? MOVIE_GENRE_IDS : TV_GENRE_IDS;
  const genreIds = selectedGenres
    .map((g) => genreMap[g])
    .filter((id): id is number => typeof id === "number");

  console.log("[random] kind:", finalKind, "genres:", genreIds);

  // Пробуем случайную страницу, но с fallback
  const randomPage = Math.floor(Math.random() * 20) + 1;

  let data = await fetchDiscover(
    apiKey,
    finalKind,
    genreIds,
    yearFrom,
    ratingFrom,
    randomPage
  );

  // Если на случайной странице пусто — берём страницу 1
  if (data.results.length === 0 && randomPage !== 1) {
    console.log("[random] fallback: page=1");
    data = await fetchDiscover(
      apiKey,
      finalKind,
      genreIds,
      yearFrom,
      ratingFrom,
      1
    );
  }

  // Если всё ещё пусто и есть рейтинг — убираем
  if (data.results.length === 0 && ratingFrom > 0) {
    console.log("[random] fallback: без рейтинга");
    data = await fetchDiscover(
      apiKey,
      finalKind,
      genreIds,
      yearFrom,
      0,
      1
    );
  }

  // Если пусто и есть год — убираем
  if (data.results.length === 0 && yearFrom > 0) {
    console.log("[random] fallback: без года");
    data = await fetchDiscover(apiKey, finalKind, genreIds, 0, 0, 1);
  }

  if (data.results.length === 0) {
    return NextResponse.json({ error: "no_shows" }, { status: 404 });
  }

  const item =
    data.results[Math.floor(Math.random() * data.results.length)];

  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids.map((id: number) => GENRE_ID_TO_EN[id]).filter(Boolean)
    : [];

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return NextResponse.json({
    tmdbId: item.id,
    kind: finalKind,
    name: item.name || item.title || "Без названия",
    originalName: item.original_name || item.original_title || null,
    description: item.overview || null,
    posterUrl: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
    year: year || null,
    genres,
    tmdbRating: item.vote_average
      ? Math.round(item.vote_average * 10) / 10
      : null,
    tmdbVotes: item.vote_count || null,
    totalMatching: data.total,
  });
}