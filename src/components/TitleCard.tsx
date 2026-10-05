"use client";

import Link from "next/link";

export type TitleCardData = {
  id: number;
  name: string;
  posterUrl?: string | null;
  avgRating?: number | null;
  isCompleted?: boolean;
  watchedEpisodes?: number;
  episodesCount?: number;
  kind?: string;
};

function ratingColor(rating: number): string {
  if (rating >= 7.5) return "badge-green";
  if (rating >= 5) return "badge-gold";
  return "badge-dark";
}

export default function TitleCard({ t }: { t: TitleCardData }) {
  const progress =
    t.episodesCount && t.episodesCount > 0
      ? Math.min(100, ((t.watchedEpisodes ?? 0) / t.episodesCount) * 100)
      : 0;

  return (
    <Link
      href={`/title/${t.id}`}
      className="group block rounded-2xl overflow-hidden border border-white/5 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/20"
    >
      <div className="relative aspect-[2/3] bg-neutral-900 overflow-hidden">
        {t.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.posterUrl}
            alt={t.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
            🎞️
          </div>
        )}

        {/* Градиент снизу — для читаемости названия */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

        {/* Оценка в правом верхнем углу */}
        {t.avgRating != null && (
          <div
            className={`absolute top-2 right-2 badge ${ratingColor(
              t.avgRating
            )} shadow-lg`}
          >
            ⭐ {t.avgRating.toFixed(1)}
          </div>
        )}

        {/* Галочка "просмотрено" */}
        {t.isCompleted && (
          <div className="absolute top-2 left-2 badge badge-green shadow-lg">
            ✓ Просмотрено
          </div>
        )}

        {/* Прогресс-бар снизу */}
        {t.kind === "series" && (t.episodesCount ?? 0) > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Счётчик серий на постере, если идёт просмотр */}
        {t.kind === "series" &&
          (t.episodesCount ?? 0) > 0 &&
          (t.watchedEpisodes ?? 0) > 0 && (
            <div className="absolute bottom-3 right-2 badge badge-dark">
              {t.watchedEpisodes}/{t.episodesCount} эп.
            </div>
          )}
      </div>

      {/* Название и мета */}
      <div className="p-3 bg-gradient-to-b from-transparent to-black/20">
        <div className="text-sm font-semibold line-clamp-2 leading-snug text-white group-hover:text-red-400 transition-colors">
          {t.name}
        </div>
      </div>
    </Link>
  );
}