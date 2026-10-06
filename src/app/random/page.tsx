"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { translateGenres } from "@/lib/genres";

type RandomShow = {
  tmdbId: number;
  kind: "series" | "movie";
  name: string;
  originalName: string | null;
  description: string | null;
  posterUrl: string | null;
  year: string | null;
  genres: string[];
  tmdbRating: number | null;
  tmdbVotes: number | null;
  totalMatching: number;
};

const GENRE_OPTIONS = [
  { value: "", label: "Все жанры" },
  { value: "боевик", label: "Боевик" },
  { value: "комедия", label: "Комедия" },
  { value: "драма", label: "Драма" },
  { value: "триллер", label: "Триллер" },
  { value: "ужасы", label: "Ужасы" },
  { value: "фантастика", label: "Фантастика" },
  { value: "фэнтези", label: "Фэнтези" },
  { value: "детектив", label: "Детектив" },
  { value: "приключения", label: "Приключения" },
  { value: "мультфильм", label: "Мультфильм" },
  { value: "криминал", label: "Криминал" },
  { value: "документальный", label: "Документальный" },
  { value: "семейный", label: "Семейный" },
  { value: "вестерн", label: "Вестерн" },
  { value: "военный", label: "Военный" },
];

export default function RandomPage() {
  const { status } = useSession();
  const router = useRouter();

  // Фильтры
  const [kind, setKind] = useState<"all" | "series" | "movie">("all");
  const [genre, setGenre] = useState("");
  const [yearFrom, setYearFrom] = useState<number>(0);
  const [ratingFrom, setRatingFrom] = useState<number>(0);

  const [show, setShow] = useState<RandomShow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setEmptyReason(null);
    try {
      const params = new URLSearchParams();
      if (kind !== "all") params.set("kind", kind);
      if (genre) params.set("genre", genre);
      if (yearFrom > 0) params.set("yearFrom", String(yearFrom));
      if (ratingFrom > 0) params.set("ratingFrom", String(ratingFrom));

      const r = await fetch(`/api/random?${params.toString()}`);
      if (r.status === 404) {
        setShow(null);
        setEmptyReason(
          "Ничего не нашлось по этим фильтрам. Попробуйте изменить условия."
        );
        return;
      }
      if (!r.ok) {
        setShow(null);
        setEmptyReason("Ошибка загрузки");
        return;
      }
      setShow(await r.json());
    } finally {
      setLoading(false);
    }
  }, [kind, genre, yearFrom, ratingFrom]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  async function addToWishlist() {
    if (!show) return;
    setBusy(true);
    try {
      // Импортируем из TMDB сразу со статусом wishlist
      const r = await fetch("/api/tmdb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: show.tmdbId,
          kind: show.kind,
          status: "wishlist",
        }),
      });
      if (r.ok) {
        setToast("✅ Добавлено в «Хочу посмотреть»!");
        setTimeout(() => setToast(null), 2500);
        // Загружаем следующий
        setTimeout(() => load(), 700);
      } else {
        const text = await r.text();
        alert(`Ошибка импорта: ${text}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function next() {
    load();
  }

  if (status === "loading") {
    return <p className="text-neutral-500">Загрузка...</p>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          🎲 Что посмотреть?
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Случайный фильм или сериал из TMDB — по вашим фильтрам
        </p>
      </div>

      {/* Фильтры */}
      <div className="card p-4 space-y-3 bg-neutral-900/40">
        <div className="flex flex-wrap gap-3">
          {/* Тип */}
          <div>
            <label className="label">Тип</label>
            <div className="flex gap-1.5">
              {(
                [
                  ["all", "Все"],
                  ["series", "Сериалы"],
                  ["movie", "Фильмы"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    kind === k
                      ? "bg-gradient-to-b from-red-500 to-red-600 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Жанр */}
          <div className="min-w-[160px]">
            <label className="label">Жанр</label>
            <select
              className="input text-sm"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Год от */}
          <div className="min-w-[120px]">
            <label className="label">Год от</label>
            <input
              type="number"
              min={0}
              max={2030}
              className="input text-sm"
              value={yearFrom || ""}
              placeholder="напр. 2010"
              onChange={(e) => setYearFrom(Number(e.target.value) || 0)}
            />
          </div>

          {/* Рейтинг от */}
          <div className="min-w-[120px]">
            <label className="label">Рейтинг от</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              className="input text-sm"
              value={ratingFrom || ""}
              placeholder="напр. 7"
              onChange={(e) => setRatingFrom(Number(e.target.value) || 0)}
            />
          </div>

          {/* Сброс + применить */}
          <div className="flex items-end gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                setKind("all");
                setGenre("");
                setYearFrom(0);
                setRatingFrom(0);
              }}
              className="btn btn-secondary text-sm"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="btn btn-primary text-sm"
            >
              {loading ? "..." : "🎲 Найти"}
            </button>
          </div>
        </div>
      </div>

      {/* Контент */}
      {loading ? (
        <p className="text-center text-neutral-500 py-12">Загрузка...</p>
      ) : emptyReason ? (
        <div className="text-center py-16 text-neutral-500">
          <div className="text-6xl mb-4">🎬</div>
          <p>{emptyReason}</p>
        </div>
      ) : show ? (
        <div className="card overflow-hidden bg-neutral-900/40">
          <div className="grid md:grid-cols-[280px_1fr] gap-6 p-6">
            {/* Постер */}
            <div className="rounded-xl overflow-hidden border border-white/5">
              {show.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={show.posterUrl}
                  alt={show.name}
                  className="w-full block"
                />
              ) : (
                <div className="aspect-[2/3] flex items-center justify-center text-6xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
                  🎞️
                </div>
              )}
            </div>

            {/* Информация */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {show.name}
                </h2>
                {show.originalName && (
                  <p className="text-neutral-500 text-sm mt-1">
                    {show.originalName}
                  </p>
                )}
              </div>

              {/* Мета-чипы */}
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
                  {show.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
                </span>
                {show.year && (
                  <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
                    📅 {show.year}
                  </span>
                )}
                {show.tmdbRating != null && (
                  <span className="badge badge-gold px-3 py-1.5 text-sm">
                    ⭐ {show.tmdbRating.toFixed(1)}
                    {show.tmdbVotes != null && (
                      <span className="opacity-70 ml-1 font-normal">
                        ({show.tmdbVotes})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Жанры */}
              {show.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {translateGenres(show.genres).map((g) => (
                    <span
                      key={g}
                      className="badge badge-dark bg-white/5 border border-white/5 px-2.5 py-1 text-xs text-neutral-300"
                    >
                      🎭 {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Описание */}
              {show.description && (
                <p className="text-neutral-300 text-sm leading-relaxed line-clamp-6">
                  {show.description}
                </p>
              )}

              {/* Счётчик */}
              <div className="text-xs text-neutral-600">
                Найдено подходящих: {show.totalMatching.toLocaleString("ru-RU")}
              </div>

              {/* Кнопки */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={addToWishlist}
                  disabled={busy}
                  className="btn btn-primary"
                >
                  {busy ? "Импортирую..." : "👀 Хочу посмотреть"}
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  ⏭ Следующий
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-neutral-500 py-12">
          Нажмите «🎲 Найти», чтобы получить случайный фильм
        </p>
      )}

      {/* Тост */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-2xl z-50 animate-in">
          {toast}
        </div>
      )}
    </div>
  );
}