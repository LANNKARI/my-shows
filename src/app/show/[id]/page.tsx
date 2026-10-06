"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type ShowData = {
  show: {
    id: number;
    name: string;
    originalName: string | null;
    description: string | null;
    posterUrl: string | null;
    kind: string;
    year: string | null;
    genres: string[];
    countries: string[];
    studios: string[];
    director: string | null;
    creators: string[];
    cast: any;
    tmdbRating: number | null;
    tmdbVotes: number | null;
    budget: number | null;
    revenue: number | null;
    runtime: number | null;
    createdBy: any;
  };
  episodes: { id: number; season: number; episode: number }[];
  comments: any[];
  userShowsCount: number;
  userShows: any[];
  avgRating: number | null;
  ratingsCount: number;
  myUserShow: {
    id: number;
    totalSeasons: number;
    totalEpisodes: number;
    isCompleted: boolean;
    isFavorite: boolean;
    dubbing: string | null;
    watchSite: string | null;
  } | null;
};

export default function ShowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ShowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/shows/${id}`);
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

  async function addToLibrary() {
    if (!data) return;
    setAdding(true);
    try {
      const r = await fetch("/api/user-shows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: data.show.id,
          totalSeasons: 1,
          totalEpisodes: data.episodes.length,
        }),
      });
      if (r.ok) {
        load();
      } else {
        alert("Ошибка добавления");
      }
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p className="text-neutral-500">Загрузка...</p>;
  if (!data) return <p className="text-neutral-500">Не найдено</p>;

  const { show, myUserShow, avgRating, ratingsCount, userShowsCount, comments } = data;

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-8 md:gap-10">
      {/* ЛЕВАЯ КОЛОНКА */}
      <aside className="space-y-5">
        <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
          {show.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={show.posterUrl} alt={show.name} className="w-full block" />
          ) : (
            <div className="aspect-[2/3] flex items-center justify-center text-6xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
              🎞️
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {myUserShow ? (
            <Link
              href={`/library/${myUserShow.id}`}
              className="btn btn-primary w-full justify-center"
            >
              📚 Моя библиотека
            </Link>
          ) : (
            <button
              type="button"
              onClick={addToLibrary}
              disabled={adding}
              className="btn btn-primary w-full justify-center"
            >
              {adding ? "Добавляю..." : "+ Добавить к себе"}
            </button>
          )}
        </div>
      </aside>

      {/* ПРАВАЯ КОЛОНКА */}
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {show.name}
          </h1>
          {show.originalName && (
            <p className="text-neutral-500 text-base mt-1">{show.originalName}</p>
          )}
        </div>

        {/* Чипы */}
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
            {show.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
          </span>
          {show.year && (
            <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300">
              📅 {show.year}
            </span>
          )}
          {show.genres.map((g) => (
            <span
              key={g}
              className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300"
            >
              🎭 {g}
            </span>
          ))}
          {avgRating != null && (
            <span className="badge badge-green px-3 py-1.5 text-sm">
              ⭐ {avgRating.toFixed(1)} ({ratingsCount})
            </span>
          )}
          {show.tmdbRating && (
            <span className="badge badge-gold px-3 py-1.5 text-sm">
              TMDB ⭐ {show.tmdbRating}
            </span>
          )}
        </div>

        {/* Описание */}
        {show.description && (
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line">
            {show.description}
          </p>
        )}

        {/* Сколько пользователей смотрят */}
        {userShowsCount > 0 && (
          <p className="text-sm text-neutral-500">
            👥 Смотрят: <span className="text-white font-semibold">{userShowsCount}</span> пользователей
          </p>
        )}

        {/* Комментарии */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Комментарии ({comments.length})</h2>
          {comments.length === 0 ? (
            <p className="text-neutral-500 text-sm">Пока нет комментариев</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-neutral-900/40 border border-white/5 p-4"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Link
                    href={`/u/${c.user.username}`}
                    className="font-medium hover:text-red-400"
                  >
                    {c.user.name || c.user.username}
                  </Link>
                  <span className="text-neutral-600 text-xs">
                    {new Date(c.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
                <p className="text-sm text-neutral-200 mt-2 whitespace-pre-wrap">
                  {c.text}
                </p>
              </div>
            ))
          )}
        </section>
      </section>
    </div>
  );
}