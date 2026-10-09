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
  isCompleted?: boolean;
  isFavorite?: boolean;
  totalSeasons?: number;
  totalEpisodes?: number;
  rating?: number | null;
  tmdbRating?: number | null;
}

const TABS = [
  { key: 'watching', label: '👀 Смотрю' },
  { key: 'planned', label: '🔖 В планах' },
  { key: 'completed', label: '✓ Просмотрено' },
  { key: 'dropped', label: '✕ Брошено' },
  { key: 'all', label: 'Все тайтлы' },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>('watching');
  const [shows, setShows] = useState<UserShowItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchShows = useCallback(async () => {
    setLoading(true);
    try {
      let res = await fetch('/api/user-shows');
      if (!res.ok) {
        res = await fetch('/api/shows');
      }

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.shows)
          ? data.shows
          : [];
        setShows(list);
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

  // Фильтрация по активной вкладке
  const filteredShows = shows.filter((s) => {
    if (activeTab === 'all') return true;
    const itemStatus = (s.status || 'watching').toLowerCase();
    return itemStatus === activeTab.toLowerCase();
  });

  // Подсчет количества в каждой категории
  const counts = {
    watching: shows.filter((s) => (s.status || 'watching') === 'watching').length,
    planned: shows.filter((s) => s.status === 'planned').length,
    completed: shows.filter((s) => s.status === 'completed').length,
    dropped: shows.filter((s) => s.status === 'dropped').length,
    all: shows.length,
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Шапка трекера */}
      <div className="border-b border-neutral-800 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>📚 Моя библиотека</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {shows.length} тайтлов
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Отслеживайте статус просмотра фильмов и сериалов
            </p>
          </div>

          {/* Быстрые ссылки */}
          <div className="flex items-center gap-2">
            <Link
              href="/random"
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center gap-1.5 border border-neutral-700/60"
            >
              <span>🎲</span>
              <span>Что посмотреть</span>
            </Link>
          </div>
        </div>

        {/* Навигация по статусам */}
        <div className="max-w-6xl mx-auto px-4 flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {TABS.map((tab) => {
            const count = counts[tab.key as keyof typeof counts] || 0;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Контентная сетка */}
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

        {!loading && filteredShows.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16 px-4 bg-neutral-900/40 border border-neutral-800 rounded-3xl">
            <div className="text-4xl mb-3">🎬</div>
            <h2 className="text-lg font-bold text-white mb-2">В этом списке пока пусто</h2>
            <p className="text-xs text-neutral-400 mb-6">
              Воспользуйтесь поиском в шапке или генератором рекомендаций, чтобы добавить новые фильмы и сериалы.
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

        {!loading && filteredShows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredShows.map((item) => {
              const displayTitle = item.title || item.name || 'Без названия';
              const targetShowId = item.showId || item.id;
              const isSeries = item.kind === 'series';

              return (
                <div
                  key={`${item.id}-${item.showId}`}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-md"
                >
                  {/* Постер */}
                  <Link
                    href={`/show/${targetShowId}`}
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
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                        Нет постера
                      </div>
                    )}

                    {/* Бейдж типа */}
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                      {isSeries ? 'Сериал' : 'Фильм'}
                    </div>

                    {/* Оценка */}
                    {item.rating && item.rating > 0 ? (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.rating}</span>
                      </div>
                    ) : item.tmdbRating && item.tmdbRating > 0 ? (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-neutral-300 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.tmdbRating.toFixed(1)}</span>
                      </div>
                    ) : null}
                  </Link>

                  {/* Описание карточки */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {item.year && (
                        <div className="text-[11px] text-neutral-500 mb-1">{item.year}</div>
                      )}
                      <Link
                        href={`/show/${targetShowId}`}
                        className="font-semibold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </Link>
                    </div>

                    {/* Действия */}
                    <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                      <Link
                        href={`/show/${targetShowId}`}
                        className="text-neutral-400 hover:text-white transition-colors"
                      >
                        Карточка →
                      </Link>

                      <Link
                        href={`/library/${item.userShowId || item.id}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Трекер
                      </Link>
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