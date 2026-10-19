'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Movie {
  id: number;
  title: string;
  originalTitle: string | null;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: string;
  rating: number | null;
  voteCount: number;
  studio?: string | null;
}

interface HomeData {
  heroMovie: Movie | null;
  recentOnline: Movie[];
  worldHits: Movie[];
  studiosMovies: {
    a24: Movie[];
    wb: Movie[];
    marvel: Movie[];
    universal: Movie[];
  };
}

type StudioTab = 'a24' | 'wb' | 'marvel' | 'universal';

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudio, setSelectedStudio] = useState<StudioTab>('a24');

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const res = await fetch('/api/home');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Ошибка загрузки главной:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
  }, []);

  if (loading) {
    return (
      <div className="space-y-10 animate-pulse pb-16">
        <div className="w-full h-80 sm:h-96 bg-neutral-900/60 rounded-3xl border border-neutral-800" />
        <div className="h-48 bg-neutral-900/40 rounded-3xl" />
        <div className="h-48 bg-neutral-900/40 rounded-3xl" />
      </div>
    );
  }

  const hero = data?.heroMovie;
  const recentOnline = data?.recentOnline || [];
  const worldHits = data?.worldHits || [];
  const currentStudioMovies = data?.studiosMovies?.[selectedStudio] || [];

  return (
    <div className="space-y-12 pb-16">
      {/* ========================================================
          1. ГЛАВНЫЙ HERO-БАННЕР
         ======================================================== */}
      {hero && (
        <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl min-h-[360px] sm:min-h-[420px] flex items-end">
          {/* Фоновый кадр */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {hero.backdropUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.backdropUrl}
                alt={hero.title}
                className="w-full h-full object-cover object-top opacity-40 scale-105"
              />
            ) : hero.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.posterUrl}
                alt={hero.title}
                className="w-full h-full object-cover opacity-25 blur-sm"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/60 to-transparent" />
          </div>

          {/* Содержимое баннера */}
          <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-md shadow-rose-600/30">
                Новинка в онлайне
              </span>
              {hero.rating && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  ★ {hero.rating}
                </span>
              )}
              {hero.year && (
                <span className="text-xs font-semibold text-neutral-400">
                  {hero.year}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
              {hero.title}
            </h1>

            {hero.overview && (
              <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed drop-shadow-sm max-w-xl">
                {hero.overview}
              </p>
            )}

            <div className="pt-2 flex items-center gap-3">
              <Link
                href={`/show/${hero.id}`}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                <span>Подробнее</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          2. СЕКЦИЯ: НЕДАВНО ПОЯВИЛИСЬ В ОНЛАЙНЕ
         ======================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>⚡ Недавно появились в онлайне</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Свежие цифровые релизы в отличном качестве
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {recentOnline.map((movie) => (
            <MovieCard key={movie.id} movie={movie} badge="Новинка" badgeColor="blue" />
          ))}
        </div>
      </section>

      {/* ========================================================
          3. СЕКЦИЯ: МИРОВЫЕ ХИТЫ
         ======================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>🏆 Мировые хиты</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Культовые картины с высочайшим признанием зрителей
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {worldHits.map((movie) => (
            <MovieCard key={movie.id} movie={movie} badge="Хит" badgeColor="amber" />
          ))}
        </div>
      </section>

      {/* ========================================================
          4. СЕКЦИЯ: ФИЛЬМЫ ОТ ТОПОВЫХ СТУДИЙ (С ТАБАМИ)
         ======================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>🎬 Кино от культовых студий</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Лучшие работы главных кинематографических домов
            </p>
          </div>

          {/* Вкладки переключения студий */}
          <div className="flex items-center gap-1.5 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800 self-start sm:self-auto overflow-x-auto no-scrollbar text-xs">
            {[
              { id: 'a24', label: 'A24' },
              { id: 'wb', label: 'Warner Bros.' },
              { id: 'marvel', label: 'Marvel' },
              { id: 'universal', label: 'Universal' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStudio(tab.id as StudioTab)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedStudio === tab.id
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {currentStudioMovies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              badge={movie.studio || undefined}
              badgeColor="purple"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// Карточка фильма
function MovieCard({
  movie,
  badge,
  badgeColor = 'blue',
}: {
  movie: Movie;
  badge?: string;
  badgeColor?: 'blue' | 'amber' | 'purple';
}) {
  const getBadgeStyle = () => {
    switch (badgeColor) {
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'blue':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg">
      <Link
        href={`/show/${movie.id}`}
        className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
            🎬 Нет постера
          </div>
        )}

        {/* Бейдж новинки / хита / студии */}
        {badge && (
          <div
            className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-md border ${getBadgeStyle()}`}
          >
            {badge}
          </div>
        )}

        {/* Рейтинг */}
        {movie.rating && movie.rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
            <span>★</span>
            <span>{movie.rating}</span>
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col justify-between flex-1">
        <div>
          {movie.year && (
            <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">
              {movie.year}
            </div>
          )}
          <Link
            href={`/show/${movie.id}`}
            className="font-bold text-xs text-white line-clamp-1 group-hover:text-rose-400 transition-colors block"
            title={movie.title}
          >
            {movie.title}
          </Link>
        </div>
      </div>
    </div>
  );
}