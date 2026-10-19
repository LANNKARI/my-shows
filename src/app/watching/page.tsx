'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface WatchingItem {
  id: number;
  userShowId: number;
  showId: number;
  title: string;
  name: string;
  posterUrl: string | null;
  year: string | null;
  kind: string;
  rating: number | null;
  totalEpisodes: number;
  progress: { watched: boolean }[];
  dubbing: string | null;
  watchSite: string | null;
}

export default function WatchingPage() {
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatching = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/user-shows?status=watching');
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchWatching();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      {/* Шапка раздела */}
      <div className="border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>👀 Смотрю сейчас</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {items.length}
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Тайтлы, которые вы смотрите в данный момент
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] bg-neutral-900 rounded-2xl border border-neutral-800"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl max-w-lg mx-auto">
            <span className="text-4xl block mb-3">🍿</span>
            <h2 className="text-base font-bold text-white mb-1">
              Сейчас вы ничего не смотрите
            </h2>
            <p className="text-xs text-neutral-400 mb-6">
              Выберите сериал или фильм на главной или через поиск и переведите его в статус «Смотрю».
            </p>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Перейти к каталогу
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => {
              const watchedCount = (item.progress || []).filter((p) => p.watched).length;
              const total = item.totalEpisodes > 0 ? item.totalEpisodes : Math.max(1, watchedCount);
              const percent = Math.min(100, Math.round((watchedCount / total) * 100));

              return (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-md"
                >
                  <Link
                    href={`/library/${item.showId}`}
                    className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
                  >
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.posterUrl}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                        🎬 Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase border border-white/10">
                      {item.kind === 'series' ? 'Сериал' : 'Фильм'}
                    </div>

                    {item.rating && item.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                        <span>★</span>
                        <span>{item.rating}</span>
                      </div>
                    )}

                    {/* Полоса прогресса внизу постера */}
                    <div className="absolute bottom-0 inset-x-0 h-1.5 bg-neutral-950">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>

                  <div className="p-3 flex flex-col justify-between flex-1">
                    <div>
                      {item.year && (
                        <div className="text-[10px] text-neutral-500 mb-0.5">
                          {item.year}
                        </div>
                      )}
                      <Link
                        href={`/library/${item.showId}`}
                        className="font-semibold text-xs text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                      >
                        {item.title || item.name}
                      </Link>
                    </div>

                    <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Прогресс:</span>
                      <span className="font-bold text-blue-400">
                        {watchedCount} / {total}
                      </span>
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