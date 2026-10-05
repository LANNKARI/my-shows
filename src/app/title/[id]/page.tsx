"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import EpisodeList from "@/components/EpisodeList";
import RatingModal from "@/components/RatingModal";
import CollectionPicker from "@/components/CollectionPicker";
import CommentSection from "@/components/CommentSection";

type TitleData = {
  id: number;
  name: string;
  originalName: string | null;
  dubbing: string | null;
  watchSite: string | null;
  posterUrl: string | null;
  isCompleted: boolean;
  isFavorite: boolean;
  kind: string;
  totalSeasons: number;
  totalEpisodes: number;
  episodes: {
    id: number;
    season: number;
    episode: number;
    watched: boolean;
    stoppedAt: string | null;
  }[];
  ratings: { id: number; score: number }[];
  collections: { collection: { id: number; name: string } }[];
  isOwner: boolean;
  user?: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
};

export default function TitlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [t, setT] = useState<TitleData | null>(null);
  const [showRating, setShowRating] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/titles/${id}`);
    if (!r.ok) return;
    setT(await r.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleCompleted() {
    if (!t) return;
    await fetch(`/api/titles/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !t.isCompleted }),
    });
    load();
  }

  async function toggleFavorite() {
    if (!t) return;
    const r = await fetch(`/api/titles/${t.id}/favorite`, {
      method: "PATCH",
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "Ошибка");
      return;
    }
    load();
  }

  async function remove() {
    if (!t || !confirm("Удалить тайтл?")) return;
    await fetch(`/api/titles/${t.id}`, { method: "DELETE" });
    router.push("/");
  }

  if (!t) return <p className="text-neutral-500">Загрузка...</p>;

  const avg = t.ratings.length
    ? t.ratings.reduce((s, r) => s + r.score, 0) / t.ratings.length
    : null;
  const watchedCount = t.episodes.filter((e) => e.watched).length;
  const progress =
    t.episodes.length > 0 ? (watchedCount / t.episodes.length) * 100 : 0;

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-8 md:gap-10">
      {/* ЛЕВАЯ КОЛОНКА */}
      <aside className="space-y-5">
        {/* Постер */}
        <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-black/50">
          {t.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.posterUrl} alt={t.name} className="w-full block" />
          ) : (
            <div className="aspect-[2/3] flex items-center justify-center text-6xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
              🎞️
            </div>
          )}
        </div>

        {/* Кнопки (свои) / подпись (чужой) */}
        <div className="flex flex-col gap-2">
          {t.isOwner ? (
            <>
              <button
                className="btn btn-secondary w-full justify-center"
                onClick={() => router.push(`/edit/${t.id}`)}
              >
                ✏️ Редактировать
              </button>

              <button
                className={`btn w-full justify-center ${
                  t.isCompleted ? "btn-secondary" : "btn-primary"
                }`}
                onClick={toggleCompleted}
              >
                {t.isCompleted ? "↩️ Снять отметку" : "✓ Отметить просмотренным"}
              </button>

              <button
                className={`btn w-full justify-center ${
                  t.isFavorite ? "btn-primary" : "btn-secondary"
                }`}
                onClick={toggleFavorite}
              >
                {t.isFavorite ? "★ В любимых" : "☆ Добавить в любимые"}
              </button>

              <button
                className="btn btn-secondary w-full justify-center"
                onClick={() => setShowRating(true)}
              >
                ⭐ Поставить оценку
              </button>

              <button
                className="btn btn-danger w-full justify-center"
                onClick={remove}
              >
                🗑 Удалить
              </button>
            </>
          ) : (
            <div className="rounded-xl bg-neutral-900/40 border border-white/5 p-4 text-xs text-neutral-500 text-center">
              Это сериал пользователя{" "}
              {t.user ? (
                <Link
                  href={`/u/${t.user.username}`}
                  className="text-red-400 hover:underline"
                >
                  @{t.user.username}
                </Link>
              ) : (
                "другого пользователя"
              )}
              <br />
              <span className="text-neutral-600">Только просмотр</span>
            </div>
          )}
        </div>
      </aside>

      {/* ПРАВАЯ КОЛОНКА */}
      <section className="space-y-6">
        {/* Название */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            {t.name}
            {t.isCompleted && (
              <span className="ml-3 inline-flex align-middle badge badge-green text-sm">
                ✓ Просмотрено
              </span>
            )}
            {t.isFavorite && (
              <span className="ml-2 inline-flex align-middle badge badge-gold text-sm">
                ★ Любимый
              </span>
            )}
          </h1>
          {t.originalName && (
            <p className="text-neutral-500 text-base mt-1">{t.originalName}</p>
          )}
        </div>

        {/* Чипы метаданных */}
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
            {t.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
          </span>
          {t.dubbing && (
            <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
              🎙 {t.dubbing}
            </span>
          )}
          {t.watchSite && <WatchSiteChip site={t.watchSite} />}
          {avg != null && (
            <span
              className={`badge ${
                avg >= 7.5
                  ? "badge-green"
                  : avg >= 5
                  ? "badge-gold"
                  : "badge-dark"
              } px-3 py-1.5 text-sm`}
            >
              ⭐ {avg.toFixed(1)} / 10
              <span className="opacity-70 ml-1 font-normal">
                ({t.ratings.length})
              </span>
            </span>
          )}
        </div>

        {/* Прогресс */}
        {t.kind === "series" && t.episodes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Прогресс просмотра</span>
              <span className="font-semibold text-white">
                {watchedCount} / {t.episodes.length}
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

        <CollectionPicker titleId={t.id} />

        {t.kind === "series" && t.episodes.length > 0 && (
          <EpisodeList titleId={t.id} episodes={t.episodes} onChanged={load} />
        )}

        <CommentSection titleId={t.id} />

        {showRating && (
          <RatingModal
            titleId={t.id}
            onClose={() => setShowRating(false)}
            onSaved={load}
          />
        )}
      </section>
    </div>
  );
}

/* ---------- Компонент-чип для сайта просмотра ---------- */
function WatchSiteChip({ site }: { site: string }) {
  const trimmed = site.trim();

  const looksLikeDomain = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed);
  const url = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : looksLikeDomain
    ? `https://${trimmed}`
    : null;

  function label(s: string): string {
    try {
      const u = new URL(s);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return s;
    }
  }

  const baseCls =
    "badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5";

  if (!url) {
    return (
      <span className={`${baseCls} text-neutral-300`}>🌐 {trimmed}</span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`${baseCls} text-red-400 underline decoration-red-400/40 underline-offset-2 hover:text-red-300 hover:decoration-red-300 hover:bg-white/10 transition-colors cursor-pointer`}
    >
      🌐 {label(url)}
      <span className="text-[10px] opacity-70 ml-1">↗</span>
    </a>
  );
}