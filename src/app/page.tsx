'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

interface MediaItem {
  id: number;
  title: string;
  originalTitle?: string;
  overview: string;
  posterUrl?: string;
  backdropUrl?: string;
  year: string;
  kind: string;
  rating?: number;
  voteCount: number;
  badge?: string;
}

interface UniverseBanner {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  accentColor: string;
}

interface DirectorBanner {
  id: string;
  name: string;
  tag: string;
  bio: string;
}

interface HomeData {
  heroSlides: MediaItem[];
  recentOnline: MediaItem[];
  universes: UniverseBanner[];
  directors: DirectorBanner[];
}

export default function HomePage() {
  const [data, setData] = useState<HomeData>();
  const [loading, setLoading] = useState(true);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoSlideTimerRef = useRef<any>(null);

  useEffect(() => {
    const fetchHome = async () => {
      try {
        const res = await fetch('/api/home');
        if (res.ok) {
          const json: HomeData = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Ошибка загрузки главной страницы:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHome();
  }, []);

  const slides = data?.heroSlides || [];

  const nextSlide = useCallback(() => {
    if (slides.length === 0) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length === 0) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    autoSlideTimerRef.current = setInterval(() => {
      nextSlide();
    }, 6000);

    return () => {
      if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    };
  }, [slides.length, isPaused, nextSlide]);

  if (loading) {
    return (
      <div className="space-y-10 animate-pulse pb-16">
        <div className="w-full h-80 sm:h-[440px] bg-neutral-900/60 rounded-3xl border border-neutral-800" />
        <div className="h-64 bg-neutral-900/40 rounded-3xl" />
        <div className="h-64 bg-neutral-900/40 rounded-3xl" />
      </div>
    );
  }

  const currentHero = slides[currentSlide] || null;
  const recentOnline = data?.recentOnline || [];
  const universes = data?.universes || [];
  const directors = data?.directors || [];

  return (
    <div className="space-y-14 pb-16">
      {/* 1. HERO-БАННЕР (8.0+, БЕЗ АНИМЕ И КОРЕИ) */}
      {currentHero && (
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl min-h-[380px] sm:min-h-[450px] flex items-end group"
        >
          {slides.map((slide, idx) => (
            <div
              key={`${slide.kind}-${slide.id}`}
              className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out ${
                idx === currentSlide ? 'opacity-100 z-0' : 'opacity-0 z-[-1]'
              }`}
            >
              {slide.backdropUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.backdropUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover object-top opacity-45 scale-105"
                />
              ) : slide.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.posterUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover opacity-25 blur-sm"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/75 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/60 to-transparent" />
            </div>
          ))}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-xl hover:scale-110"
                aria-label="Предыдущий слайд"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-xl hover:scale-110"
                aria-label="Следующий слайд"
              >
                ›
              </button>
            </>
          )}

          <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-md shadow-rose-600/30">
                🔥 Выбор зрителей 8.0+
              </span>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  currentHero.kind === 'series'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {currentHero.kind === 'series' ? 'Сериал' : 'Фильм'}
              </span>

              {currentHero.rating && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  ★ {currentHero.rating}
                </span>
              )}

              {currentHero.year && (
                <span className="text-xs font-semibold text-neutral-300">
                  {currentHero.year}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
              {currentHero.title}
            </h1>

            {currentHero.overview && (
              <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed drop-shadow-sm max-w-xl">
                {currentHero.overview}
              </p>
            )}

            <div className="pt-2 flex items-center gap-3">
              <Link
                href={`/show/${currentHero.id}?type=${currentHero.kind === 'series' ? 'tv' : 'movie'}`}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2"
              >
                <span>Открыть карточку</span>
                <span>→</span>
              </Link>
            </div>

            {slides.length > 1 && (
              <div className="pt-3 flex items-center gap-1.5">
                {slides.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => setCurrentSlide(dotIdx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      dotIdx === currentSlide
                        ? 'w-7 bg-rose-500'
                        : 'w-2 bg-neutral-700 hover:bg-neutral-500'
                    }`}
                    aria-label={`Слайд ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. СВЕЖИЕ ПРЕМЬЕРЫ И СЕЗОНЫ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <span>⚡ Свежие премьеры и сезоны</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Мировые блокбастеры и новые сезоны главных сериалов (обновляется автоматически)
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {recentOnline.map((item) => (
            <MediaCard
              key={`recent-${item.kind}-${item.id}`}
              item={item}
              badge={item.kind === 'series' ? 'Сериал' : 'Фильм'}
              badgeColor={item.kind === 'series' ? 'indigo' : 'blue'}
            />
          ))}
        </div>
      </section>

      {/* 3. БАННЕРЫ 15 КИНОВСЕЛЕННЫХ */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <span>🌌 Киновселенные и франшизы</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {universes.length} коллекций
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Нажмите на баннер вселенной, чтобы открыть все её фильмы и сериалы в хронологическом порядке
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {universes.map((uni) => (
            <Link
              key={uni.id}
              href={`/universes/${uni.id}`}
              className={`group relative overflow-hidden rounded-2xl border border-neutral-800 hover:border-neutral-600 bg-gradient-to-br ${uni.accentColor} p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-lg flex items-center justify-between gap-4`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  {uni.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-white group-hover:text-rose-400 transition-colors truncate">
                    {uni.name}
                  </h3>
                  <p className="text-[11px] text-neutral-300/80 line-clamp-2 mt-0.5 leading-snug">
                    {uni.subtitle}
                  </p>
                </div>
              </div>

              <span className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-rose-600 text-neutral-400 group-hover:text-white flex items-center justify-center text-sm transition-all flex-shrink-0">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. БАННЕРЫ 8 ВЕЛИКИХ РЕЖИССЁРОВ */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <span>🎬 Коллекции великих режиссёров</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {directors.length} мастеров
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Выберите режиссёра, чтобы открыть полную хронологию его фильмов и сериалов от новых к старым
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {directors.map((dir) => (
            <Link
              key={dir.id}
              href={`/directors/${dir.id}`}
              className="group relative overflow-hidden rounded-2xl border border-neutral-800 hover:border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-lg flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    Режиссёр
                  </span>
                  <span className="text-xs text-neutral-500 group-hover:text-amber-400 transition-colors">
                    Все работы →
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-white group-hover:text-amber-400 transition-colors">
                  {dir.name}
                </h3>

                <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {dir.tag}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MediaCard({
  item,
  badge,
  badgeColor = 'blue',
}: {
  item: MediaItem;
  badge?: string;
  badgeColor?: string;
}) {
  const getBadgeStyle = () => {
    switch (badgeColor) {
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'indigo':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'blue':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const linkHref = `/show/${item.id}?type=${item.kind === 'series' ? 'tv' : 'movie'}`;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg">
      <Link
        href={linkHref}
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

        {badge && (
          <div
            className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-md border max-w-[70%] truncate ${getBadgeStyle()}`}
          >
            {badge}
          </div>
        )}

        {item.rating && item.rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
            <span>★</span>
            <span>{item.rating}</span>
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col justify-between flex-1">
        <div>
          {item.year && (
            <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">
              {item.year}
            </div>
          )}
          <Link
            href={linkHref}
            className="font-bold text-xs text-white line-clamp-1 group-hover:text-rose-400 transition-colors block"
            title={item.title}
          >
            {item.title}
          </Link>
        </div>
      </div>
    </div>
  );
}