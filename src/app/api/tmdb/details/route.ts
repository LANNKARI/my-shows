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
    // Для фильмов — просто возвращаем пустые сезоны
    if (kind === "movie") {
      return NextResponse.json({
        numberOfSeasons: 1,
        numberOfEpisodes: 1,
        episodesPerSeason: [1],
      });
    }

    // Для сериала — запрашиваем детали
    const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: "TMDB error" }, { status: 502 });
    }

    const data = await res.json();

    const numberOfSeasons = data.number_of_seasons || 1;
    const numberOfEpisodes = data.number_of_episodes || 0;

    // Разбивка по сезонам — из data.seasons[]
    const seasons = Array.isArray(data.seasons) ? data.seasons : [];

    // Оставляем только реальные сезоны (не «Specials» — сезон 0)
    const realSeasons = seasons
      .filter((s: any) => s.season_number > 0)
      .sort((a: any, b: any) => a.season_number - b.season_number);

    const episodesPerSeason = realSeasons.map(
      (s: any) => s.episode_count || 0
    );

    // Если разбивки нет — распределяем равномерно
    if (episodesPerSeason.length === 0 && numberOfEpisodes > 0) {
      const base = Math.floor(numberOfEpisodes / numberOfSeasons);
      const extra = numberOfEpisodes % numberOfSeasons;
      for (let i = 0; i < numberOfSeasons; i++) {
        episodesPerSeason.push(base + (i < extra ? 1 : 0));
      }
    }

    return NextResponse.json({
      numberOfSeasons,
      numberOfEpisodes,
      episodesPerSeason,
    });
  } catch (e: any) {
    console.error("[TMDB details] Ошибка:", e.message);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}