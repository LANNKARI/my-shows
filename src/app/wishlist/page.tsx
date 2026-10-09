'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WishlistItem {
  id: number;
  showId: number;
  title: string;
  originalTitle?: string;
  posterUrl: string | null;
  year?: string;
  kind?: string;
  rating?: number | null;
  genres?: string[];
}

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wishlist');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Ошибка загрузки Wishlist:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Перевод тайтла из "В планах" в "Смотрю"
  const handleStartWatching = async (showId: number) => {
    try {
      const res = await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          status: 'watching',
        }),
      });

      if (res.ok) {
        // Убираем из списка желаемого
        setItems((prev) => prev.filter((it) => it.showId !== showId));
        router.push(`/library/${showId}`);
      }
    } catch (err) {
      console.error('Ошибка старта просмотра:', err);
    }
  };

  // Удаление из списка желаемого
  const handleRemove = async (showId: number) => {
    try {
      const res = await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId,
          status: 'dropped',
        }),
      });

      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.showId !== showId));
      }
    } catch (err) {
      console.error('Ошибка удаления:', err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Шапка раздела */}
      <div className="border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🔖 Хочу посмотреть</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {items.length} в планах
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Фильмы и сериалы, отложенные на будущее
            </p>
          </div>

          <Link
            href="/random"
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center gap-1.5 border border-neutral-700/60"
          >
            <span>🎲</span>
            <span>Подобрать ещё</span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-neutral-900 rounded-2xl h-80 border border-neutral-800"
              />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16 px-4 bg-neutral-900/40 border border-neutral-800 rounded-3xl">
            <div className="text-4xl mb-3">🔖</div>
            <h2 className="text-lg font-bold text-white mb-2">Список желаемого пуст</h2>
            <p className="text-xs text-neutral-400 mb-6">
              Добавляйте заинтересовавшие картины из раздела «Что посмотреть» или поиска.
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

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => {
              const isSeries = item.kind === 'series';

              return (
                <div
                  key={`${item.id}-${item.showId}`}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-md"
                >
                  {/* Постер с гарантированной загрузкой */}
                  <Link
                    href={`/show/${item.showId}`}
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
                        Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                      {isSeries ? 'Сериал' : 'Фильм'}
                    </div>

                    {item.rating && item.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {item.year && (
                        <div className="text-[11px] text-neutral-500 mb-1">{item.year}</div>
                      )}
                      <Link
                        href={`/show/${item.showId}`}
                        className="font-semibold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                      >
                        {item.title}
                      </Link>
                    </div>

                    {/* Кнопки действий */}
                    <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-xs gap-1">
                      <button
                        onClick={() => handleStartWatching(item.showId)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                      >
                        Смотрю →
                      </button>

                      <button
                        onClick={() => handleRemove(item.showId)}
                        className="text-xs text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Удалить из списка"
                      >
                        ✕
                      </button>
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