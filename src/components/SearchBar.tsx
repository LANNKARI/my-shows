"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type CatalogItem = {
  id: number;
  name: string;
  originalName: string | null;
  posterUrl: string | null;
  kind: string;
  year: string | null;
  tmdbRating: number | null;
  userShowsCount: number;
  commentsCount: number;
};

type TmdbItem = {
  tmdbId: number;
  kind: "series" | "movie";
  name: string;
  originalName: string | null;
  posterPath: string | null;
  year: string;
  rating: number | null;
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [tmdb, setTmdb] = useState<TmdbItem[]>([]);
  const [importingId, setImportingId] = useState<number | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Закрытие при клике вне
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Дебаунс поиска
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCatalog([]);
      setTmdb([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [catalogRes, tmdbRes] = await Promise.all([
          fetch(`/api/shows?q=${encodeURIComponent(q)}`),
          fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`),
        ]);

        const catalogData = catalogRes.ok ? await catalogRes.json() : [];
        const tmdbData = tmdbRes.ok ? await tmdbRes.json() : [];

        setCatalog(Array.isArray(catalogData) ? catalogData.slice(0, 5) : []);
        setTmdb(Array.isArray(tmdbData) ? tmdbData.slice(0, 5) : []);
      } catch {
        setCatalog([]);
        setTmdb([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleTmdbPick(item: TmdbItem) {
    setImportingId(item.tmdbId);
    try {
      const r = await fetch("/api/tmdb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          kind: item.kind === "movie" ? "movie" : "series",
          status: "watching",
        }),
      });

      if (!r.ok) {
        const err = await r.text();
        alert(`Ошибка импорта: ${err}`);
        return;
      }

      const data = await r.json();
      setOpen(false);
      setQuery("");
      router.push(`/show/${data.showId}`);
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    } finally {
      setImportingId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim().length >= 2) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;
  const hasAny = catalog.length > 0 || tmdb.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      {/* Иконка поиска */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </svg>

      <input
        className="input !pl-10 w-full"
        placeholder="Поиск фильмов и сериалов..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 card bg-neutral-900 border border-white/10 shadow-2xl max-h-[70vh] overflow-y-auto z-50">
          {loading && (
            <div className="p-4 text-center text-sm text-neutral-500">
              Поиск...
            </div>
          )}

          {!loading && !hasAny && (
            <div className="p-4 text-center text-sm text-neutral-500">
              Ничего не найдено
            </div>
          )}

          {/* ── Каталог ── */}
          {catalog.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-neutral-500 font-semibold bg-white/[0.02] border-b border-white/5">
                📚 В каталоге
              </div>
              {catalog.map((item) => (
                <Link
                  key={`c-${item.id}`}
                  href={`/show/${item.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.posterUrl}
                      alt=""
                      className="w-9 rounded object-cover shrink-0"
                      style={{ height: "54px" }}
                    />
                  ) : (
                    <div
                      className="rounded bg-neutral-800 shrink-0 flex items-center justify-center"
                      style={{ width: "36px", height: "54px" }}
                    >
                      🎞️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {item.originalName}
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">
                      {item.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
                      {item.year && ` · ${item.year}`}
                      {item.tmdbRating != null && ` · ⭐ ${item.tmdbRating}`}
                      {item.userShowsCount > 0 &&
                        ` · 👥 ${item.userShowsCount}`}
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500 shrink-0">
                    Перейти →
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* ── TMDB ── */}
          {tmdb.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-neutral-500 font-semibold bg-white/[0.02] border-y border-white/5">
                🎬 Из TMDB (нажмите — добавится в каталог)
              </div>
              {tmdb.map((item) => (
                <button
                  key={`t-${item.tmdbId}`}
                  type="button"
                  onClick={() => handleTmdbPick(item)}
                  disabled={importingId === item.tmdbId}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left disabled:opacity-50"
                >
                  {item.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.posterPath}
                      alt=""
                      className="w-9 rounded object-cover shrink-0"
                      style={{ height: "54px" }}
                    />
                  ) : (
                    <div
                      className="rounded bg-neutral-800 shrink-0 flex items-center justify-center"
                      style={{ width: "36px", height: "54px" }}
                    >
                      🎞️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {item.originalName}
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">
                      {item.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
                      {item.year && ` · ${item.year}`}
                      {item.rating != null && ` · ⭐ ${item.rating}`}
                    </div>
                  </div>
                  <span className="text-xs text-red-400 shrink-0">
                    {importingId === item.tmdbId ? "Импорт..." : "+ Добавить"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Кнопка "Показать все" */}
          {hasAny && (
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-xs text-neutral-400 hover:text-white hover:bg-white/5 border-t border-white/5 transition"
            >
              Показать все результаты →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}