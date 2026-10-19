'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface MediaItem {
  id: number;
  title: string;
  originalTitle?: string;
  overview: string;
  posterUrl?: string;
  backdropUrl?: string;
  year: string;
  releaseDate: string;
  kind: string;
  rating?: number;
  badge?: string;
}

interface UniverseInfo {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  accentColor: string;
}

export default function UniversePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [universe, setUniverse] = useState<UniverseInfo>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchUniverse = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/home?universe=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          setUniverse(data.universe);
          setItems(data.items || []);
        }
      } catch (e) {
        console.error('Ошибка загрузки вселенной:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUniverse();
  }, [id]);

  const moviesCount = items.filter((i) => i.kind === 'movie').length;
  const seriesCount = items.filter((i) => i.kind === 'series').length;

  const filteredItems = items.filter((item) => {
    if (filter === 'movies') return item.kind === 'movie';
    if (filter === 'series') return item.kind === 'series';
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse pb-16">
        <div className="h-52 bg-neutral-900 rounded-3xl border border-neutral-800" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="aspect-[2/3] bg-neutral-900 rounded-2xl border border-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="p-12 text-center bg-neutral-900 rounded-3xl border border-neutral-800">
        <h1 className="text-xl font-bold text-white mb-2">Киновселенная не найдена</h1>
        <Link href="/" className="text-xs text-rose-400 hover:underline">
          ← Вернуться на главную
        </Link>
      </div>
    );
  }

  const coverBackdrop = items.find((i) => i.backdropUrl)?.backdropUrl;

  return (
    <div className="space-y-8 pb-20">
      {/* Шапка вселенной */}
      <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900 p-6 sm:p-10 shadow-2xl">
        {coverBackdrop && (
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverBackdrop}
              alt={universe.name}
              className="w-full h-full object-cover opacity-25 scale-105 blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-neutral-950/40" />
          </div>
        )}

        <div className="relative z-10 space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <span>← На главную</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">{universe.icon}</span>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                {universe.name}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 mt-1">
                {universe.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-800/80">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Хронология релиза:</span>
              <strong className="text-white">от самых новых к старым ↓</strong>
            </div>

            {/* Переключатель: Все / Фильмы / Сериалы */}
            <div className="flex items-center gap-1.5 bg-neutral-950/90 p-1 rounded-2xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'all' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Все ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('movies')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'movies' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Фильмы ({moviesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('series')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'series' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Сериалы ({seriesCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Сетка всех фильмов и сериалов в хронологическом порядке (новые сверху) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredItems.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg"
          >
            <Link
              href={`/show/${item.id}`}
              className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
            >
              {item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                  🎬 Нет постера
                </div>
              )}

              <div
                className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-md border ${
                  item.kind === 'series'
                    ? 'bg-indigo-500/25 text-indigo-200 border-indigo-500/40'
                    : 'bg-blue-500/25 text-blue-200 border-blue-500/40'
                }`}
              >
                {item.kind === 'series' ? 'Сериал' : 'Фильм'}
              </div>

              {item.rating && item.rating > 0 && (
                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                  <span>★</span>
                  <span>{item.rating}</span>
                </div>
              )}
            </Link>

            <div className="p-3 flex flex-col justify-between flex-1">
              <div>
                <div className="text-[11px] text-rose-400 font-bold mb-0.5">
                  {item.year || 'Скоро'}
                </div>
                <Link
                  href={`/show/${item.id}`}
                  className="font-bold text-xs text-white line-clamp-2 group-hover:text-rose-400 transition-colors block"
                  title={item.title}
                >
                  {item.title}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}