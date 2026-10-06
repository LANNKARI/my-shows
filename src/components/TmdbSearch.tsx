"use client";

import { useState } from "react";

export type TmdbResult = {
  tmdbId: number;
  kind: "series" | "movie";
  name: string;
  originalName: string | null;
  overview: string | null;
  posterPath: string | null;
  year: string;
  rating: number | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  episodesPerSeason?: number[] | null;
};

export default function TmdbSearch({
  onPick,
}: {
  onPick: (result: TmdbResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const r = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
      if (!r.ok) {
        setError("Ошибка поиска");
        return;
      }
      const data = await r.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handlePick(result: TmdbResult) {
  setPicked(result.tmdbId);

  let cloudinaryUrl: string | null = result.posterPath;
  let numberOfSeasons: number | null = null;
  let numberOfEpisodes: number | null = null;
  let episodesPerSeason: number[] | null = null;

  // 1. Импортируем постер в Cloudinary
  if (result.posterPath) {
    try {
      const r = await fetch("/api/tmdb/import-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.posterPath }),
      });
      if (r.ok) {
        const { url } = await r.json();
        cloudinaryUrl = url;
      }
    } catch {
      cloudinaryUrl = result.posterPath;
    }
  }

  // 2. Получаем детали (сезоны, серии)
  if (result.kind === "series") {
    try {
      const r = await fetch(
        `/api/tmdb/details?id=${result.tmdbId}&kind=series`
      );
      if (r.ok) {
        const d = await r.json();
        numberOfSeasons = d.numberOfSeasons || null;
        numberOfEpisodes = d.numberOfEpisodes || null;
        episodesPerSeason = d.episodesPerSeason || null;
      }
    } catch {
      // если не получилось — оставляем пустым
    }
  }

  onPick({
    ...result,
    posterPath: cloudinaryUrl,
    numberOfSeasons,
    numberOfEpisodes,
    episodesPerSeason,
  });

  setOpen(false);
  setQuery("");
  setResults([]);
  setSearched(false);
  setPicked(null);
}

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary w-full justify-center"
      >
        🔍 Найти в TMDB
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-2xl bg-neutral-900 border border-white/10 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold">🔍 Поиск в TMDB</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-white/5">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Введите название (мин. 2 символа)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={loading || query.trim().length < 2}
                  className="btn btn-primary"
                >
                  {loading ? "..." : "Найти"}
                </button>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>

            <div className="overflow-y-auto p-2">
              {loading && (
                <p className="text-center text-neutral-500 py-6">Поиск...</p>
              )}

              {!loading && searched && results.length === 0 && (
                <p className="text-center text-neutral-500 py-6">
                  Ничего не найдено
                </p>
              )}

              {!loading && !searched && (
                <p className="text-center text-neutral-500 py-6 text-sm">
                  Введите название и нажмите «Найти»
                </p>
              )}

              <div className="space-y-1">
                {results.map((r) => (
                  <button
                    key={r.tmdbId}
                    type="button"
                    onClick={() => handlePick(r)}
                    disabled={picked === r.tmdbId}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition text-left disabled:opacity-50"
                  >
                    {r.posterPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.posterPath}
                        alt=""
                        className="rounded object-cover shrink-0"
                        style={{ width: "40px", height: "60px" }}
                      />
                    ) : (
                      <div
                        className="rounded bg-neutral-800 shrink-0 flex items-center justify-center"
                        style={{ width: "40px", height: "60px" }}
                      >
                        🎞️
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.name}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        {r.originalName}
                      </div>
                      <div className="text-[10px] text-neutral-600 mt-0.5">
                        {r.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
                        {r.year && ` · ${r.year}`}
                        {r.rating != null && ` · ⭐ ${r.rating}`}
                      </div>
                    </div>

                    {picked === r.tmdbId && (
                      <span className="text-xs text-neutral-500 shrink-0">
                        Импорт...
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}