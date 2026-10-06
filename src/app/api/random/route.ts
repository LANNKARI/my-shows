import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

// Карта: русский жанр → TMDB ID (для фильмов)
const MOVIE_GENRE_IDS: Record<string, number> = {
  боевик: 28,
  приключения: 12,
  мультфильм: 16,
  комедия: 35,
  криминал: 80,
  документальный: 99,
  драма: 18,
  семейный: 10751,
  фэнтези: 14,
  история: 36,
  ужасы: 27,
  музыка: 10402,
  детектив: 9648,
  романтика: 10749,
  фантастика: 878,
  триллер: 53,
  военный: 10752,
  вестерн: 37,
};

// Карта: русский жанр → TMDB ID (для сериалов)
const TV_GENRE_IDS: Record<string, number> = {
  боевик: 10759,
  приключения: 10759,
  мультфильм: 16,
  комедия: 35,
  криминал: 80,
  документальный: 99,
  драма: 18,
  семейный: 10751,
  фэнтези: 10765,
  детектив: 9648,
  фантастика: 10765,
  военный: 10768,
  вестерн: 37,
  kids: 10762,
  реалити: 10764,
  новости: 10763,
  "ток-шоу": 10767,
};

// Обратный маппинг: TMDB ID → английский жанр (для отображения)
const GENRE_ID_TO_EN: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

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
  const genre = (params.get("genre") || "").toLowerCase().trim();
  const yearFrom = Number(params.get("yearFrom")) || 0;
  const ratingFrom = Number(params.get("ratingFrom")) || 0;

  // Если "all" — случайно выбираем сериал или фильм
  if (kind === "all") {
    kind = Math.random() < 0.5 ? "series" : "movie";
  }

  const isMovie = kind === "movie";
  const endpoint = isMovie ? "movie" : "tv";

  // Собираем параметры Discover
  const query = new URLSearchParams();
  query.set("api_key", apiKey);
  query.set("language", "ru-RU");
  query.set("sort_by", "popularity.desc");
  query.set("include_adult", "false");
  query.set("vote_count.gte", "100"); // чтобы не показывать мусор

  if (ratingFrom > 0) {
    query.set("vote_average.gte", String(ratingFrom));
  }

  if (yearFrom > 0) {
    if (isMovie) {
      query.set("primary_release_date.gte", `${yearFrom}-01-01`);
    } else {
      query.set("first_air_date.gte", `${yearFrom}-01-01`);
    }
  }

  if (genre) {
    const genreMap = isMovie ? MOVIE_GENRE_IDS : TV_GENRE_IDS;
    const genreId = genreMap[genre];
    if (genreId) {
      query.set("with_genres", String(genreId));
    }
  }

  // Случайная страница (1–20) — TMDB отдаёт до 500 страниц
  const randomPage = Math.floor(Math.random() * 20) + 1;
  query.set("page", String(randomPage));

  const url = `${TMDB_BASE}/discover/${endpoint}?${query.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("[random] TMDB error:", await res.text());
      return NextResponse.json({ error: "TMDB error" }, { status: 502 });
    }

    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      return NextResponse.json({ error: "no_shows" }, { status: 404 });
    }

    // Берём случайный из первой страницы
    const item = results[Math.floor(Math.random() * results.length)];

    const genres = Array.isArray(item.genre_ids)
      ? item.genre_ids
          .map((id: number) => GENRE_ID_TO_EN[id])
          .filter(Boolean)
      : [];

    const year = (item.release_date || item.first_air_date || "").slice(0, 4);

    return NextResponse.json({
      tmdbId: item.id,
      kind,
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
      totalMatching: data.total_results || 0,
    });
  } catch (e: any) {
    console.error("[random] error:", e.message);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}