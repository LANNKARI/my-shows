"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import WatchSiteChip from "@/components/WatchSiteChip";
import RatingModal from "@/components/RatingModal";

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

type RatingItem = {
  id: number;
  score: number;
  episodeId: number | null;
};

type UserShowData = {
  id: number;
  userId: string;
  showId: number;
  totalSeasons: number;
  totalEpisodes: number;
  isCompleted: boolean;
  isFavorite: boolean;
  status: string; // ← новое
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
  ratings: RatingItem[];
};

// ────────────────────────────────────────────────
// Хелпер вне компонента — не зависит от data
// ────────────────────────────────────────────────
function getEpisodeRating(
  ratings: RatingItem[],
  episodeId: number
): number | null {
  const rating = ratings.find((r) => r.episodeId === episodeId);
  return rating ? rating.score : null;
}

export default function LibraryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<UserShowData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(new Set());
  const [autoOpened, setAutoOpened] = useState(false);
  const [editDubbing, setEditDubbing] = useState("");
  const [editWatchSite, setEditWatchSite] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Модалка оценки
  const [showRating, setShowRating] = useState(false);
  const [ratingForEpisode, setRatingForEpisode] = useState<number | null>(null);

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

  // Автооткрытие первого незавершённого сезона — ТОЛЬКО ПРИ ПЕРВОЙ ЗАГРУЗКЕ
  useEffect(() => {
    if (autoOpened || !data) return;
    const seasonsList = Array.from(
      new Set(data.progress.map((p) => p.episode.season))
    ).sort((a, b) => a - b);
    const firstIncomplete = seasonsList.find((s) =>
      data.progress
        .filter((p) => p.episode.season === s)
        .some((p) => !p.watched)
    );
    const toOpen = firstIncomplete ?? seasonsList[0];
    if (toOpen != null) {
      setOpenSeasons(new Set([toOpen]));
    }
    setAutoOpened(true);
  }, [data, autoOpened]);

  async function changeStatus(newStatus: "wishlist" | "watching" | "completed") {
    if (!data) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/user-shows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) {
        alert("Ошибка смены статуса");
        return;
      }
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEpisode(progress: EpisodeProgress) {
    await fetch(`/api/user-shows/${id}/episodes/${progress.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched: !progress.watched }),
    });
    load();
  }

  function openEdit() {
    if (!data) return;
    setEditDubbing(data.dubbing || "");
    setEditWatchSite(data.watchSite || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    await fetch(`/api/user-shows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dubbing: editDubbing,
        watchSite: editWatchSite,
      }),
    });
    setEditOpen(false);
    load();
  }

  function toggleSeason(s: number) {
    setOpenSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
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

  async function removeFromLibrary() {
    if (!confirm("Удалить из библиотеки? Прогресс будет потерян.")) return;
    await fetch(`/api/user-shows/${id}`, { method: "DELETE" });
    router.push("/");
  }

  function openRatingModal(episodeId: number | null) {
    setRatingForEpisode(episodeId);
    setShowRating(true);
  }

  if (loading) return <p className="text-neutral-500">Загрузка...</p>;
  if (!data) return <p className="text-neutral-500">Не найдено</p>;

  const watchedCount = data.progress.filter((p) => p.watched).length;
  const progress =
    data.progress.length > 0 ? (watchedCount / data.progress.length) * 100 : 0;

  const seasons = Array.from(
    new Set(data.progress.map((p) => p.episode.season))
  ).sort((a, b) => a - b);

  // Средняя оценка по тайтлу (без episodeId)
  const wholeRatings = data.ratings.filter((r) => r.episodeId === null);
  const avgRating = wholeRatings.length
    ? wholeRatings.reduce((s, r) => s + r.score, 0) / wholeRatings.length
    : null;

  // Значение для предзаполнения модалки
  const initialScore = (() => {
    if (ratingForEpisode != null) {
      return getEpisodeRating(data.ratings, ratingForEpisode);
    }
    return wholeRatings[0]?.score ?? null;
  })();

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

          {/* ── Переключатель статуса ── */}
          <div className="rounded-xl bg-neutral-900/60 border border-white/5 p-3 space-y-2">
            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-1">
              Статус
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => changeStatus("wishlist")}
                disabled={busy}
                className={`btn text-xs w-full justify-start ${
                  data.status === "wishlist" ? "btn-primary" : "btn-secondary"
                }`}
              >
                👀 Хочу посмотреть
              </button>
              <button
                type="button"
                onClick={() => changeStatus("watching")}
                disabled={busy}
                className={`btn text-xs w-full justify-start ${
                  data.status === "watching" ? "btn-primary" : "btn-secondary"
                }`}
              >
                📺 Смотрю
              </button>
              <button
                type="button"
                onClick={() => changeStatus("completed")}
                disabled={busy}
                className={`btn text-xs w-full justify-start ${
                  data.status === "completed" ? "btn-primary" : "btn-secondary"
                }`}
              >
                ✅ Просмотрено
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={openEdit}
            className="btn btn-secondary w-full justify-center"
          >
            ✏️ Редактировать
          </button>

          <button
            type="button"
            onClick={() => openRatingModal(null)}
            className="btn btn-secondary w-full justify-center"
          >
            ⭐ Поставить оценку
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
            {data.status === "wishlist" && (
              <span className="ml-3 inline-flex align-middle badge badge-dark bg-white/5 border border-white/5 text-sm text-neutral-300">
                👀 В планах
              </span>
            )}
            {data.status === "watching" && (
              <span className="ml-3 inline-flex align-middle badge badge-dark bg-white/5 border border-white/5 text-sm text-neutral-300">
                📺 Смотрю
              </span>
            )}
            {data.status === "completed" && (
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

          {/* Чипы: озвучка, сайт, средняя оценка */}
          {(data.dubbing || data.watchSite || avgRating != null) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.dubbing && (
                <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
                  🎙 {data.dubbing}
                </span>
              )}
              {data.watchSite && <WatchSiteChip site={data.watchSite} />}
              {avgRating != null && (
                <span className="badge badge-gold px-3 py-1.5 text-sm">
                  ⭐ {avgRating.toFixed(1)}
                  <span className="opacity-70 ml-1 font-normal">
                    ({wholeRatings.length})
                  </span>
                </span>
              )}
            </div>
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

        {/* Кнопки управления сезонами */}
        {seasons.length > 1 && (
          <div className="flex justify-end gap-3 text-xs">
            <button
              type="button"
              onClick={() => setOpenSeasons(new Set(seasons))}
              className="text-neutral-500 hover:text-white transition"
            >
              Развернуть все
            </button>
            <span className="text-neutral-700">·</span>
            <button
              type="button"
              onClick={() => setOpenSeasons(new Set())}
              className="text-neutral-500 hover:text-white transition"
            >
              Свернуть все
            </button>
          </div>
        )}

        {/* Серии — аккордеон по сезонам */}
        <div className="space-y-3">
          {seasons.map((s) => {
            const seasonProgress = data.progress.filter(
              (p) => p.episode.season === s
            );
            const seasonWatched = seasonProgress.filter((p) => p.watched).length;
            const isOpen = openSeasons.has(s);
            const allWatched = seasonWatched === seasonProgress.length;
            const percent =
              seasonProgress.length > 0
                ? (seasonWatched / seasonProgress.length) * 100
                : 0;

            return (
              <div
                key={s}
                className="rounded-xl border border-white/5 bg-neutral-900/40 overflow-hidden transition-colors hover:border-white/10"
              >
                <button
                  type="button"
                  onClick={() => toggleSeason(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span
                    className={`text-neutral-500 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-90" : "rotate-0"
                    }`}
                  >
                    ▶
                  </span>

                  <span className="text-sm font-semibold tracking-wide">
                    Сезон {s}
                  </span>

                  {allWatched && (
                    <span className="badge badge-green text-[10px] px-2 py-0.5">
                      ✓ Завершён
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-3">
                    <div className="hidden sm:block w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 tabular-nums shrink-0">
                      {seasonWatched} / {seasonProgress.length}
                    </span>
                  </div>
                </button>

                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-3 pb-3 pt-3 border-t border-white/5 space-y-2">
                      {seasonProgress.map((p) => {
                        const epRating = getEpisodeRating(
                          data.ratings,
                          p.episode.id
                        );
                        return (
                          <div
                            key={p.id}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                              p.watched
                                ? "bg-emerald-950/20 border-emerald-900/40"
                                : "bg-neutral-900/60 border-white/5 hover:border-white/10"
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

                            {epRating != null && (
                              <span className="badge badge-gold text-[10px] px-2 py-0.5 shrink-0">
                                ⭐ {epRating}
                              </span>
                            )}

                            <input
                              className="input max-w-[130px] text-xs py-1.5"
                              placeholder="00:34:12"
                              value={p.stoppedAt ?? ""}
                              onChange={(e) =>
                                updateStoppedAt(p, e.target.value)
                              }
                            />

                            <button
                              type="button"
                              onClick={() => openRatingModal(p.episode.id)}
                              className="btn btn-secondary text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Оценить серию"
                            >
                              ⭐
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* МОДАЛКА редактирования */}
      {editOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="card w-full max-w-md bg-neutral-900 border border-white/10 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">✏️ Редактировать запись</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Озвучка</label>
                <input
                  className="input"
                  value={editDubbing}
                  onChange={(e) => setEditDubbing(e.target.value)}
                  placeholder="Например: LostFilm"
                />
              </div>

              <div>
                <label className="label">Сайт просмотра</label>
                <input
                  className="input"
                  value={editWatchSite}
                  onChange={(e) => setEditWatchSite(e.target.value)}
                  placeholder="Например: https://example.com"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="btn btn-primary"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА оценки */}
      {showRating && (
        <RatingModal
          userShowId={data.id}
          episodeId={ratingForEpisode}
          initialScore={initialScore}
          onClose={() => setShowRating(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}