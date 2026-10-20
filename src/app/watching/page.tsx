'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface EpisodeProgress {
  id: number;
  watched: boolean;
}

interface ShowItem {
  id: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  year: string | null;
  kind: string;
  tmdbRating: number | null;
}

interface WatchingItem {
  id: number;
  showId: number;
  status: string;
  show: ShowItem;
  progress?: EpisodeProgress[];
  ratings?: { score: number }[];
}

export default function WatchingPage() {
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatching = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-shows?status=watching');
      if (res.ok) {
        const data = await res.json();
        // 🔥 ИСПРАВЛЕНИЕ: Учитываем оба варианта ответа от вашего API (массив напрямую или объект с items)
        const fetchedItems = Array.isArray(data) ? data : (data.items || data.data || []);
        setItems(fetchedItems);
      }
    } catch (e) {
      console.error('Ошибка загрузки просматриваемых:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatching();
  }, []);

  return (
    <div className="space-y-8 pb-20">
      {/* ШАПКА СО СКРУГЛЕНИЕМ rounded-3xl */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👀</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Смотрю сейчас
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {items.length}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Тайтлы, которые вы смотрите в данный момент
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="aspect-[2/3] bg-neutral-900 rounded-2xl border border-neutral-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-neutral-900/40 rounded-3xl border border-neutral-800/80 space-y-3">
          <div className="text-4xl">🎬</div>
          <h2 className="text-base font-bold text-white">Вы пока ничего не смотрите</h2>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            Перейдите в каталог и отметьте интересующий фильм или сериал статусом «Смотрю».
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => {
            const show = item.show;
            if (!show) return null;
            const targetId = show.tmdbId || show.id;
            const linkHref = `/show/${targetId}?type=${show.kind === 'series' ? 'tv' : 'movie'}`;
            const watchedCount = (item.progress || []).filter((p) => p.watched).length;
            const totalCount = item.progress?.length || 0;
            const progressPercent = totalCount > 0 ? (watchedCount / totalCount) * 100 : 0;
            const userRating = item.ratings?.[0]?.score;

            return (
              <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg">
                <Link href={linkHref} className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block">
                  {show.posterUrl ? (
                    <img src={show.posterUrl} alt={show.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">Нет постера</div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-md border bg-indigo-500/25 text-indigo-200 border-indigo-500/40">
                    {show.kind === 'series' ? 'Сериал' : 'Фильм'}
                  </div>

                  {userRating ? (
                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                      <span>★</span><span>{userRating}</span>
                    </div>
                  ) : show.tmdbRating && show.tmdbRating > 0 ? (
                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                      <span>★</span><span>{show.tmdbRating.toFixed(1)}</span>
                    </div>
                  ) : null}

                  {show.kind === 'series' && totalCount > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
                      <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}
                </Link>

                <div className="p-3 flex flex-col justify-between flex-1 space-y-2">
                  <div>
                    {show.year && <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">{show.year}</div>}
                    <Link href={linkHref} className="font-bold text-xs text-white line-clamp-1 group-hover:text-blue-400 transition-colors block" title={show.title}>
                      {show.title}
                    </Link>
                  </div>
                  {show.kind === 'series' && totalCount > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Прогресс:</span>
                      <span className="font-semibold text-white">{watchedCount} / {totalCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}