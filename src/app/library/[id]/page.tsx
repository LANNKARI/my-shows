"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type EpisodeProgress = {
  id: number;
  watched: boolean;
  stoppedAt: string | null;
  watchedAt: string | null;
  episode: {
    id: number;
    season: number;
    episode: number;
  };
};

type UserShowData = {
  id: number;
  userId: string;
  showId: number;
  totalSeasons: number;
  totalEpisodes: number;
  isCompleted: boolean;
  isFavorite: boolean;
  dubbing: string | null;
  watchSite: string | null;
  show: {
    id: number;
    name: string;
    originalName: string | null;
    posterUrl: string | null;
    kind: string;
  };
  progress: EpisodeProgress[];
  ratings: { id: number; score: number }[];
};

export default function LibraryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<UserShowData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/user-shows/${id}`);
    if (!r.ok) {
      setLoading(false);
      return;
    }
    setData(await r.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEpisode(progress: EpisodeProgress) {
    await fetch(`/api/user-shows/${id}/episodes/${progress.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched: !progress.watched }),
    });
    load();
  }

  async function updateStoppedAt(progress: EpisodeProgress, value: string) {
    await fetch(`/api/user-shows/${id}/episodes/${progress.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stoppedAt: value }),
    });
    load();
  }

  async function toggleFavorite() {
    if (!data) return;
    await fetch(`/api/user-shows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !data.isFavorite }),
    });
    load();
  }

  async function toggleCompleted() {
    if (!data) return;
    await fetch(`/api/user-shows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !data.isCompleted }),
    });
    load();
  }

  async function removeFromLibrary() {
    if (!confirm("Удалить из библиотеки? Прогресс будет потерян.")) return;
    await fetch(`/api/user-shows/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <p className="text-neutral-500">Загрузка...</p>;
  if (!data) return <p className="text-neutral-500">Не найдено</p>;

  const watchedCount = data.progress.filter((p) => p.watched).length;
  const progress =
    data.progress.length > 0 ? (watchedCount / data.progress.length) * 100 : 0;

  // Группировка серий по сезонам
  const seasons = Array.from(
    new Set(data.progress.map((p) => p.episode.season))
  ).sort((a, b) => a - b);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-8 md:gap-10">
      {/* ЛЕВАЯ КОЛОНКА */}
      <aside className="space-y-5">
        <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
          {data.show.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.show.posterUrl}
              alt={data.show.name}
              className="w-full block"
            />
          ) : (
            <div className="aspect-[2/3] flex items-center justify-center text-6xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
              🎞️
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/show/${data.show.id}`}
            className="btn btn-secondary w-full justify-center"
          >
            📖 Каталог
          </Link>

          <button
            className={`btn w-full justify-center ${
              data.isCompleted ? "btn-secondary" : "btn-primary"
            }`}
            onClick={toggleCompleted}
            type="button"
          >
            {data.isCompleted ? "↩️ Снять отметку" : "✓ Отметить просмотренным"}
          </button>

          <button
            className={`btn w-full justify-center ${
              data.isFavorite ? "btn-primary" : "btn-secondary"
            }`}
            onClick={toggleFavorite}
            type="button"
          >
            {data.isFavorite ? "★ В любимых" : "☆ В любимые"}
          </button>

          <button
            className="btn btn-danger w-full justify-center"
            onClick={removeFromLibrary}
            type="button"
          >
            🗑 Убрать из библиотеки
          </button>
        </div>
      </aside>

      {/* ПРАВАЯ КОЛОНКА */}
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {data.show.name}
            {data.isCompleted && (
              <span className="ml-3 inline-flex align-middle badge badge-green text-sm">
                ✓ Просмотрено
              </span>
            )}
            {data.isFavorite && (
              <span className="ml-2 inline-flex align-middle badge badge-gold text-sm">
                ★ Любимый
              </span>
            )}
          </h1>
          {data.show.originalName && (
            <p className="text-neutral-500 text-base mt-1">
              {data.show.originalName}
            </p>
          )}
        </div>

        {/* Прогресс */}
        {data.progress.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Прогресс просмотра</span>
              <span className="font-semibold text-white">
                {watchedCount} / {data.progress.length}
              </span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Серии */}
        <div className="space-y-4">
          {seasons.map((s) => {
            const seasonProgress = data.progress.filter(
              (p) => p.episode.season === s
            );
            const seasonWatched = seasonProgress.filter((p) => p.watched).length;

            return (
              <div key={s}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                    Сезон {s}
                  </h3>
                  <span className="text-xs text-neutral-600">
                    {seasonWatched} / {seasonProgress.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {seasonProgress.map((p) => (
                    <div
                      key={p.id}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                        p.watched
                          ? "bg-emerald-950/20 border-emerald-900/40"
                          : "bg-neutral-900/40 border-white/5 hover:border-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleEpisode(p)}
                        className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold transition-all ${
                          p.watched
                            ? "bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-500 text-white shadow-lg"
                            : "border-white/15 hover:border-white/40 text-transparent hover:text-white/40"
                        }`}
                      >
                        ✓
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            p.watched
                              ? "text-neutral-400 line-through"
                              : "text-neutral-100"
                          }`}
                        >
                          S{String(p.episode.season).padStart(2, "0")}E
                          {String(p.episode.episode).padStart(2, "0")}
                        </div>
                      </div>

                      <input
                        className="input max-w-[140px] text-xs py-1.5"
                        placeholder="00:34:12"
                        value={p.stoppedAt ?? ""}
                        onChange={(e) => updateStoppedAt(p, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}