import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json([]);

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("[TMDB] Ключ не настроен в .env");
    return NextResponse.json(
      { error: "TMDB_API_KEY не настроен" },
      { status: 500 }
    );
  }

  try {
    const url =
      `${TMDB_BASE}/search/multi?api_key=${apiKey}` +
      `&language=ru-RU&query=${encodeURIComponent(q)}&include_adult=false`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      console.error("[TMDB] Ошибка ответа:", text.slice(0, 500));
      return NextResponse.json({ error: "TMDB error" }, { status: 502 });
    }

    const data = await res.json();

    const results = (data.results || [])
      .filter((r: any) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 15)
      .map((r: any) => ({
        tmdbId: r.id,
        kind: r.media_type === "tv" ? "series" : "movie",
        name: r.name || r.title || "Без названия",
        originalName: r.original_name || r.original_title || null,
        overview: r.overview || null,
        posterPath: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
        year: (r.first_air_date || r.release_date || "").slice(0, 4),
        rating: r.vote_average
          ? Math.round(r.vote_average * 10) / 10
          : null,
        numberOfSeasons:
          r.media_type === "tv" ? r.number_of_seasons || null : null,
        numberOfEpisodes:
          r.media_type === "tv" ? r.number_of_episodes || null : null,
      }));

    return NextResponse.json(results);
  } catch (e: any) {
    console.error("[TMDB] Ошибка:", e.message, e.cause);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}