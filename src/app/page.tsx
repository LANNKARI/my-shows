"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TitleCard, { TitleCardData } from "@/components/TitleCard";
import FriendsActivity from "@/components/FriendsActivity";

export default function Home() {
  const [items, setItems] = useState<TitleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<
    "all" | "series" | "movie" | "completed" | "in_progress"
  >("all");

  useEffect(() => {
  fetch("/api/user-shows")
    .then((r) => r.json())
    .then((data) => {
      if (!Array.isArray(data)) {
        setItems([]);
        return;
      }
      // Преобразуем UserShow → TitleCardData
      const mapped: TitleCardData[] = data.map((us: any) => ({
        id: us.show.id,
        name: us.show.name,
        posterUrl: us.show.posterUrl,
        avgRating: us.avgRating,
        isCompleted: us.isCompleted,
        watchedEpisodes: us.watchedEpisodes,
        episodesCount: us.episodesCount,
        kind: us.show.kind,
      }));
      setItems(mapped);
    })
    .catch(() => setItems([]))
    .finally(() => setLoading(false));
}, []);

  const filtered = items.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "series" && t.kind !== "series") return false;
    if (filter === "movie" && t.kind !== "movie") return false;
    if (filter === "completed" && !t.isCompleted) return false;
    if (filter === "in_progress" && t.isCompleted) return false;
    return true;
  });

  const seriesCount = items.filter((t) => t.kind === "series").length;
  const movieCount = items.filter((t) => t.kind === "movie").length;

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Моя библиотека
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            {seriesCount > 0 && <>{seriesCount} сериалов</>}
            {seriesCount > 0 && movieCount > 0 && " · "}
            {movieCount > 0 && <>{movieCount} фильмов</>}
            {seriesCount === 0 && movieCount === 0 && "Пока ничего нет"}
          </p>
        </div>
      </div>

      <FriendsActivity />

      {/* Поиск + фильтры */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative md:max-w-xs w-full">
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
            className="input !pl-10"
            placeholder="Поиск по названию..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["all", "Все"],
              ["series", "Сериалы"],
              ["movie", "Фильмы"],
              ["in_progress", "В процессе"],
              ["completed", "Просмотрено"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                filter === k
                  ? "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-900/40"
                  : "bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      {loading ? (
        <p className="text-neutral-500">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-neutral-500">
          <div className="text-6xl mb-4">🎬</div>
          <p className="mb-1 text-lg text-neutral-300">
            {items.length === 0
              ? "Библиотека пуста"
              : "Ничего не найдено по фильтру"}
          </p>
          <p className="mb-6 text-sm">
            {items.length === 0
              ? "Добавьте первый сериал или фильм — начните свою коллекцию."
              : "Попробуйте изменить поиск или фильтр."}
          </p>
          {items.length === 0 && (
            <Link href="/new" className="btn btn-primary">
              + Добавить первый
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
          {filtered.map((t, i) => (
            <div
              key={t.id}
              className="animate-in"
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            >
              <TitleCard t={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}