'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface ShowItem {
  id: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  year: string | null;
  kind: string;
  tmdbRating: number | null;
}

interface WishlistItem {
  id: number;
  showId: number;
  status: string;
  show: ShowItem;
}

interface RecItem {
  id: number;
  title: string;
  posterUrl: string | null;
  year: string;
  kind: string;
  rating: number | null;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RecItem[]>([]);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-shows?status=planned');
      if (res.ok) {
        const data = await res.json();
        const fetchedItems = Array.isArray(data) ? data : (data.items || data.data || []);
        setItems(fetchedItems);
      }
    } catch (e) {
      console.error('Ошибка загрузки отложенных:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/recommendations/global');
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setIsPersonalized(Boolean(data.isPersonalized));
      }
    } catch (e) {
      console.error('Ошибка загрузки рекомендаций:', e);
    }
  };

  useEffect(() => {
    fetchWishlist();
    fetchRecommendations();
  }, []);

  const handleRemove = async (showId: number) => {
    try {
      const res = await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, status: null }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.show?.id !== showId && i.showId !== showId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveToWatching = async (showId: number) => {
    try {
      const res = await fetch('/api/user-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId, status: 'watching' }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.show?.id !== showId && i.showId !== showId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scrollRecs = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -420 : 420;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* 1. ШАПКА СТРАНИЦЫ */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📌</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Хочу посмотреть
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {items.length} в планах
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400">
              Фильмы и сериалы, отложенные на будущее
            </p>
          </div>

          {/* Изумрудная кнопка, ведущая на рулетку /random */}
          <Link
            href="/random"
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-900/30 hover:scale-[1.02] flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <span>🎲</span>
            <span>Подобрать ещё</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* 2. СЕТКА ОТЛОЖЕННЫХ ТАЙТЛОВ */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="aspect-[2/3] bg-neutral-900 rounded-2xl border border-neutral-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-neutral-900/40 rounded-3xl border border-neutral-800/80 space-y-3">
          <div className="text-4xl">🍿</div>
          <h2 className="text-base font-bold text-white">Список пока пуст</h2>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            Добавляйте заинтересовавшие картины из каталога или воспользуйтесь рекомендациями ниже.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => {
            const show = item.show;
            if (!show) return null;
            const targetId = show.tmdbId || show.id;
            const linkHref = `/show/${targetId}?type=${show.kind === 'series' ? 'tv' : 'movie'}`;

            return (
              <div
                key={item.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg"
              >
                <Link href={linkHref} className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block">
                  {show.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={show.posterUrl}
                      alt={show.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                      🎬 Нет постера
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-md border bg-blue-500/25 text-blue-200 border-blue-500/40">
                    {show.kind === 'series' ? 'Сериал' : 'Фильм'}
                  </div>

                  {show.tmdbRating && show.tmdbRating > 0 && (
                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                      <span>★</span>
                      <span>{show.tmdbRating.toFixed(1)}</span>
                    </div>
                  )}
                </Link>

                <div className="p-3 flex flex-col justify-between flex-1 space-y-2">
                  <div>
                    {show.year && (
                      <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">
                        {show.year}
                      </div>
                    )}
                    <Link
                      href={linkHref}
                      className="font-bold text-xs text-white line-clamp-1 group-hover:text-rose-400 transition-colors block"
                      title={show.title}
                    >
                      {show.title}
                    </Link>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleMoveToWatching(show.id)}
                      className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer text-[11px] flex items-center gap-1"
                    >
                      <span>Смотрю →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(show.id)}
                      className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                      title="Убрать из планов"
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

      {/* 3. ЗАМЕТНАЯ И АККУРАТНАЯ ГРАНИЦА РАЗДЕЛЕНИЯ */}
      <div className="relative py-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-neutral-800/80" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-neutral-950 px-4 py-1 text-xs font-bold text-neutral-400 rounded-full border border-neutral-800 flex items-center gap-2 shadow-md">
            <span>✨</span>
            <span>{isPersonalized ? 'Подобрано на основе ваших вкусов' : 'Рекомендуем посмотреть'}</span>
          </span>
        </div>
      </div>

      {/* 4. ГОРИЗОНТАЛЬНАЯ ЛЕНТА РЕКОМЕНДАЦИЙ */}
      {recommendations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <span>🎯 Рекомендации для вас</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isPersonalized
                  ? 'Анализ жанров и оценок из всех ваших списков'
                  : 'Популярные мировые релизы с высоким рейтингом 8.0+'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollRecs('left')}
                className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-all shadow-md cursor-pointer active:scale-95"
                aria-label="Назад"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scrollRecs('right')}
                className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center text-sm transition-all shadow-md cursor-pointer active:scale-95"
                aria-label="Вперёд"
              >
                ›
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-3 scroll-smooth no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {recommendations.map((rec) => {
              const linkHref = `/show/${rec.id}?type=${rec.kind === 'series' ? 'tv' : 'movie'}`;
              return (
                <div
                  key={`${rec.kind}-${rec.id}`}
                  className="w-36 sm:w-44 flex-shrink-0 bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 rounded-2xl overflow-hidden transition-all flex flex-col group shadow-lg"
                >
                  <Link href={linkHref} className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block">
                    {rec.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rec.posterUrl}
                        alt={rec.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                        🎬 Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase backdrop-blur-md border bg-purple-500/25 text-purple-200 border-purple-500/40">
                      {rec.kind === 'series' ? 'Сериал' : 'Фильм'}
                    </div>

                    {rec.rating && rec.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 border border-amber-500/20">
                        ★ {rec.rating}
                      </div>
                    )}
                  </Link>

                  <div className="p-2.5 flex flex-col justify-between flex-1">
                    <div>
                      {rec.year && (
                        <div className="text-[10px] text-neutral-500 font-medium mb-0.5">
                          {rec.year}
                        </div>
                      )}
                      <Link
                        href={linkHref}
                        className="font-bold text-xs text-white line-clamp-1 group-hover:text-rose-400 transition-colors block"
                        title={rec.title}
                      >
                        {rec.title}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}