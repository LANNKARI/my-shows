'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UNIFIED_GENRES } from '@/lib/genres';

interface MediaItem {
  id: number;
  tmdbId: number;
  type: 'movie' | 'tv';
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string;
  year: string;
  voteAverage: number;
  voteCount: number;
  genres: string[];
}

const YEAR_OPTIONS = [
  { label: 'За все время', value: 0 },
  { label: 'Новинки (от 2024)', value: 2024 },
  { label: 'От 2022 года', value: 2022 },
  { label: 'От 2020 года', value: 2020 },
  { label: 'От 2015 года', value: 2015 },
  { label: 'От 2010 года', value: 2010 },
  { label: 'От 2000 года', value: 2000 },
  { label: 'От 1990 года', value: 1990 },
];

const RATING_OPTIONS = [
  { label: 'Любая оценка', value: 0 },
  { label: '6.0+ (Нормальные)', value: 6.0 },
  { label: '7.0+ (Хорошие)', value: 7.0 },
  { label: '7.5+ (Высокий рейтинг)', value: 7.5 },
  { label: '8.0+ (Отличные)', value: 8.0 },
  { label: '8.5+ (Шедевры кино)', value: 8.5 },
  { label: '9.0+ (Абсолютный топ)', value: 9.0 },
];

export default function WhatToWatchPage() {
  const router = useRouter();

  const [contentType, setContentType] = useState<'all' | 'movie' | 'tv'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(7.0);
  const [excludeAnimation, setExcludeAnimation] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'roulette' | 'list'>('roulette');
  const [randomItem, setRandomItem] = useState<MediaItem | null>(null);
  const [itemsList, setItemsList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [wishlistedMap, setWishlistedMap] = useState<Record<number, boolean>>({});
  const [wishlistLoadingId, setWishlistLoadingId] = useState<number | null>(null);
  const [navigatingId, setNavigatingId] = useState<number | null>(null);

  const toggleGenre = (key: string) => {
    setSelectedGenres((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  // Запрос случайного тайтла (Рулетка)
  const spinRoulette = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        mode: 'roulette',
        type: contentType,
        minRating: minRating.toString(),
        yearFrom: yearFrom.toString(),
        excludeAnimation: excludeAnimation.toString(),
      });

      if (selectedGenres.length > 0) {
        params.set('genres', selectedGenres.join('|'));
      }

      const res = await fetch(`/api/random?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Ошибка при получении тайтла');
      }

      if (data.randomItem) {
        setRandomItem(data.randomItem);
      } else {
        setRandomItem(null);
        setErrorMsg(
          data.message ||
            'Ничего не найдено по данным параметрам. Попробуйте немного понизить планку рейтинга или убрать часть фильтров.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [contentType, minRating, yearFrom, selectedGenres, excludeAnimation]);

  // Запрос подборки списком
  const fetchList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        mode: 'list',
        type: contentType,
        minRating: minRating.toString(),
        yearFrom: yearFrom.toString(),
        excludeAnimation: excludeAnimation.toString(),
      });

      if (selectedGenres.length > 0) {
        params.set('genres', selectedGenres.join('|'));
      }

      const res = await fetch(`/api/random?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Ошибка при загрузке подборки');
      }

      setItemsList(data.items || []);
      if (!data.items || data.items.length === 0) {
        setErrorMsg('По вашим фильтрам ничего не найдено. Попробуйте смягчить параметры.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [contentType, minRating, yearFrom, selectedGenres, excludeAnimation]);

  // Открытие страницы фильма на сайте с сохранением типа контента (?type=tv / ?type=movie)
  const handleOpenShow = async (item: MediaItem) => {
    setNavigatingId(item.id);
    const typeParam = item.type === 'tv' ? 'tv' : 'movie';
    try {
      const res = await fetch('/api/tmdb/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          type: item.type,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const targetId = data.show?.id || data.id || item.tmdbId;
        router.push(`/show/${targetId}?type=${typeParam}`);
        return;
      }
    } catch (err) {
      console.error('Ошибка импорта перед открытием:', err);
    }
    router.push(`/show/${item.tmdbId}?type=${typeParam}`);
  };

  // Добавление в Wishlist
  const handleAddToWishlist = async (item: MediaItem) => {
    setWishlistLoadingId(item.id);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          type: item.type,
        }),
      });

      if (res.status === 401) {
        alert('Пожалуйста, авторизуйтесь на сайте, чтобы сохранять тайтлы в Wishlist.');
        return;
      }

      if (!res.ok) {
        throw new Error('Не удалось добавить в список');
      }

      setWishlistedMap((prev) => ({ ...prev, [item.id]: true }));
    } catch (err) {
      console.error('Ошибка добавления в Wishlist:', err);
      alert('Ошибка при сохранении в Wishlist. Попробуйте еще раз.');
    } finally {
      setWishlistLoadingId(null);
    }
  };

  useEffect(() => {
    spinRoulette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8 pb-20">
      {/* 1. НОВАЯ ШАПКА СО СКРУГЛЕНИЕМ rounded-3xl (В ЕДИНОМ СТИЛЕ ВСЕХ СТРАНИЦ) */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍿</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Что посмотреть
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                TMDB Discovery
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400">
              Подбор фильмов и сериалов с переходом сразу в карточку на сайте
            </p>
          </div>

          {/* Переключатель режимов: Рулетка / Подборка */}
          <div className="flex bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 self-start sm:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => {
                setActiveTab('roulette');
                if (!randomItem) spinRoulette();
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'roulette'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🎲</span>
              <span>Рулетка</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                if (itemsList.length === 0) fetchList();
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>📋</span>
              <span>Подборка</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Тип контента */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Тип контента
            </label>
            <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setContentType('all')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  contentType === 'all'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setContentType('movie')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  contentType === 'movie'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Фильмы
              </button>
              <button
                type="button"
                onClick={() => setContentType('tv')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  contentType === 'tv'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Сериалы
              </button>
            </div>
          </div>

          {/* Минимальный рейтинг */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 flex items-center justify-between">
              <span>Рейтинг TMDB</span>
              <span className="text-amber-400 font-bold">
                {minRating > 0 ? `ОТ ${minRating.toFixed(1)} ★` : 'Любой'}
              </span>
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs sm:text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Год релиза */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Год релиза
            </label>
            <select
              value={yearFrom}
              onChange={(e) => setYearFrom(parseInt(e.target.value, 10))}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs sm:text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
            >
              {YEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Тумблер «Без аниме и мультиков» */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setExcludeAnimation(!excludeAnimation)}
            className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              excludeAnimation
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm shadow-rose-500/10'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                excludeAnimation
                  ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-neutral-600'
              }`}
            />
            <span>Без аниме и мультиков</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                excludeAnimation
                  ? 'bg-rose-500/25 text-rose-200'
                  : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              {excludeAnimation ? 'Вкл' : 'Выкл'}
            </span>
          </button>

          {minRating >= 8.5 && (
            <span className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              💡 При оценке 8.5+ ищутся мировые шедевры
            </span>
          )}
        </div>

        {/* Жанры */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Жанры (по любому совпадению)
            </label>
            {selectedGenres.length > 0 && (
              <button
                type="button"
                onClick={clearGenres}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-medium"
              >
                Сбросить ({selectedGenres.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {UNIFIED_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre.key);
              return (
                <button
                  key={genre.key}
                  type="button"
                  onClick={() => toggleGenre(genre.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20 border border-blue-400/40'
                      : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  {isSelected && <span className="mr-1">✓</span>}
                  {genre.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка запуска */}
        <div className="pt-4 border-t border-neutral-800/80">
          {activeTab === 'roulette' ? (
            <button
              onClick={spinRoulette}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Ищем тайтл...</span>
                </>
              ) : (
                <>
                  <span>🎲</span>
                  <span>{randomItem ? 'Крутить ещё раз' : 'Крутить рулетку'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={fetchList}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Загрузка подборки...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Найти подходящие</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Сообщение об ошибке */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center text-rose-300 max-w-xl mx-auto">
          <p className="text-base font-bold mb-1">Ничего не найдено</p>
          <p className="text-xs opacity-80 leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* 3. РЕЖИМ РУЛЕТКИ */}
      {activeTab === 'roulette' && (
        <div>
          {loading && !randomItem && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-8 max-w-4xl mx-auto animate-pulse flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-72 h-96 bg-neutral-800 rounded-2xl" />
              <div className="flex-1 space-y-4">
                <div className="h-8 bg-neutral-800 rounded-lg w-3/4" />
                <div className="h-4 bg-neutral-800 rounded w-1/2" />
                <div className="h-28 bg-neutral-800 rounded-lg" />
              </div>
            </div>
          )}

          {!loading && randomItem && (
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl overflow-hidden max-w-4xl mx-auto shadow-2xl relative">
              {randomItem.backdropUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-15 blur-xl pointer-events-none"
                  style={{ backgroundImage: `url(${randomItem.backdropUrl})` }}
                />
              )}

              <div className="relative p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
                {/* Постер */}
                <div
                  onClick={() => handleOpenShow(randomItem)}
                  className="w-full md:w-72 flex-shrink-0 cursor-pointer group mx-auto md:mx-0"
                  title="Открыть страницу тайтла"
                >
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-xl relative">
                    {randomItem.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={randomItem.posterUrl}
                        alt={randomItem.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm">
                        Нет постера
                      </div>
                    )}

                    <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-white border border-white/10">
                      {randomItem.type === 'movie' ? 'Фильм' : 'Сериал'}
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-2">
                      <span>🎬 Открыть карточку</span>
                    </div>
                  </div>
                </div>

                {/* Инфо и кнопки */}
                <div className="flex-1 flex flex-col h-full w-full">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {randomItem.year}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs">
                      <span>★</span>
                      <span>{randomItem.voteAverage.toFixed(1)}</span>
                      <span className="text-neutral-500 text-[11px] font-normal">
                        ({randomItem.voteCount} оценок)
                      </span>
                    </div>
                  </div>

                  <h2
                    onClick={() => handleOpenShow(randomItem)}
                    className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1 cursor-pointer hover:text-blue-400 transition-colors"
                  >
                    {randomItem.title}
                  </h2>

                  {randomItem.originalTitle && randomItem.originalTitle !== randomItem.title && (
                    <p className="text-sm text-neutral-400 mb-4 font-normal italic">
                      {randomItem.originalTitle}
                    </p>
                  )}

                  {randomItem.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {randomItem.genres.map((g) => (
                        <span
                          key={g}
                          className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 border border-neutral-700/50"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-neutral-300 leading-relaxed mb-6 line-clamp-5">
                    {randomItem.overview}
                  </div>

                  {/* Кнопки действий */}
                  <div className="mt-auto pt-4 border-t border-neutral-800/80 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={spinRoulette}
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 border border-neutral-700 cursor-pointer"
                    >
                      <span>🎲 Крутить ещё</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenShow(randomItem)}
                      disabled={navigatingId === randomItem.id}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                    >
                      {navigatingId === randomItem.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Переходим...</span>
                        </>
                      ) : (
                        <>
                          <span>🎬 Открыть на сайте</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToWishlist(randomItem)}
                      disabled={wishlistLoadingId === randomItem.id || wishlistedMap[randomItem.id]}
                      className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
                        wishlistedMap[randomItem.id]
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                      }`}
                    >
                      {wishlistLoadingId === randomItem.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : wishlistedMap[randomItem.id] ? (
                        <span>✓ В Wishlist</span>
                      ) : (
                        <span>🔖 Хочу посмотреть</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. РЕЖИМ ПОДБОРКИ */}
      {activeTab === 'list' && (
        <div>
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="bg-neutral-900 rounded-2xl h-80 border border-neutral-800" />
              ))}
            </div>
          )}

          {!loading && itemsList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {itemsList.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-lg"
                >
                  <div
                    onClick={() => handleOpenShow(item)}
                    className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden cursor-pointer"
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

                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase border border-white/10">
                      {item.type === 'movie' ? 'Фильм' : 'Сериал'}
                    </div>

                    <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5 border border-amber-500/20">
                      <span>★</span>
                      <span>{item.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-neutral-500 font-medium mb-1">{item.year}</div>
                      <h3
                        onClick={() => handleOpenShow(item)}
                        className="font-bold text-xs text-white line-clamp-1 cursor-pointer hover:text-blue-400 transition-colors"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      {item.genres.length > 0 && (
                        <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                          {item.genres.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenShow(item)}
                        disabled={navigatingId === item.id}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {navigatingId === item.id ? '...' : 'Карточка →'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToWishlist(item)}
                        disabled={wishlistLoadingId === item.id || wishlistedMap[item.id]}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          wishlistedMap[item.id]
                            ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                        title="Добавить в Wishlist"
                      >
                        {wishlistLoadingId === item.id ? '...' : wishlistedMap[item.id] ? '✓ Wishlist' : '🔖 Хочу'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}