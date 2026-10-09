'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface UserShowItem {
  id: number;
  userShowId?: number;
  showId: number;
  title: string;
  name?: string;
  originalTitle?: string;
  posterUrl: string | null;
  year?: string;
  kind?: string;
  status: string;
  totalEpisodes?: number;
  progress?: { episodeId: number; watched: boolean }[];
  show?: {
    episodes?: { id: number; season: number; episode: number }[];
  };
}

export default function HomePage() {
  const [shows, setShows] = useState<UserShowItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchShows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-shows?status=watching');
      if (res.ok) {
        const data = await res.json();
        setShows(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Ошибка загрузки библиотеки:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  const getProgressStats = (item: UserShowItem) => {
    const totalEps = item.totalEpisodes || item.show?.episodes?.length || (item.kind === 'movie' ? 1 : 0);
    const watchedCount = (item.progress || []).filter((p) => p.watched).length;
    const percent = totalEps > 0 ? Math.round((watchedCount / totalEps) * 100) : 0;
    return { totalEps, watchedCount, percent };
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      <div className="border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>👀 Сейчас смотрю</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {shows.length} активных
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Нажмите на карточку, чтобы открыть трекер серий и отметить просмотр
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/wishlist"
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center gap-1.5 border border-neutral-700/60"
            >
              <span>🔖</span>
              <span>В планах</span>
            </Link>
            <Link
              href="/random"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <span>🎲</span>
              <span>Что посмотреть</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="bg-neutral-900 rounded-2xl h-80 border border-neutral-800" />
            ))}
          </div>
        )}

        {!loading && shows.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16 px-4 bg-neutral-900/40 border border-neutral-800 rounded-3xl">
            <div className="text-4xl mb-3">🎬</div>
            <h2 className="text-lg font-bold text-white mb-2">Сейчас ничего не отслеживается</h2>
            <p className="text-xs text-neutral-400 mb-6">
              Выберите фильм или сериал через поиск или рекомендации, переведите в статус «Смотрю», и он появится здесь вместе с трекером серий.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/random"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-md shadow-blue-600/20"
              >
                🎲 Что посмотреть
              </Link>
            </div>
          </div>
        )}

        {!loading && shows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {shows.map((item) => {
              const displayTitle = item.title || item.name || 'Без названия';
              const targetShowId = item.showId;
              const isSeries = item.kind === 'series';
              const { totalEps, watchedCount, percent } = getProgressStats(item);

              return (
                <div
                  key={`${item.id}-${item.showId}`}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-md"
                >
                  {/* Клик открывает напрямую страницу трекера */}
                  <Link
                    href={`/library/${targetShowId}`}
                    className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
                  >
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.posterUrl}
                        alt={displayTitle}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-neutral-600">
                        🎬 Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                      {isSeries ? 'Сериал' : 'Фильм'}
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold text-xs gap-1.5">
                      <span>📖 Трекер серий</span>
                    </div>
                  </Link>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {item.year && (
                        <div className="text-[11px] text-neutral-500 mb-1">{item.year}</div>
                      )}
                      <Link
                        href={`/library/${targetShowId}`}
                        className="font-semibold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </Link>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-800/80">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                        <span>Прогресс:</span>
                        <span className="text-blue-400 font-bold">
                          {watchedCount}/{totalEps > 0 ? totalEps : '?'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}