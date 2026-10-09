'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  const [contentType, setContentType] = useState<'all' | 'movie' | 'tv'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(7.0);

  const [activeTab, setActiveTab] = useState<'roulette' | 'list'>('roulette');
  const [randomItem, setRandomItem] = useState<MediaItem | null>(null);
  const [itemsList, setItemsList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Переключение жанра (мультивыбор)
  const toggleGenre = (key: string) => {
    setSelectedGenres((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  // Запрос случайного фильма (Рулетка)
  const spinRoulette = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        mode: 'roulette',
        type: contentType,
        minRating: minRating.toString(),
        yearFrom: yearFrom.toString(),
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
  }, [contentType, minRating, yearFrom, selectedGenres]);

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
  }, [contentType, minRating, yearFrom, selectedGenres]);

  // Первоначальный запуск рулетки при открытии страницы
  useEffect(() => {
    spinRoulette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Шапка страницы */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🍿 Что посмотреть</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                TMDB Discovery
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Умный поиск по базе фильмов и сериалов с гибкими фильтрами
            </p>
          </div>

          {/* Переключатель режимов */}
          <div className="flex bg-neutral-800/80 p-1 rounded-xl border border-neutral-700/60 self-start sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('roulette');
                if (!randomItem) spinRoulette();
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'roulette'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              🎲 Рулетка
            </button>
            <button
              onClick={() => {
                setActiveTab('list');
                if (itemsList.length === 0) fetchList();
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              📋 Подборка
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Блок фильтров */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 sm:p-6 mb-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            {/* Тип контента */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Тип контента
              </label>
              <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setContentType('all')}
                  className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                    contentType === 'all'
                      ? 'bg-neutral-800 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('movie')}
                  className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                    contentType === 'movie'
                      ? 'bg-neutral-800 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Фильмы
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('tv')}
                  className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                    contentType === 'tv'
                      ? 'bg-neutral-800 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Сериалы
                </button>
              </div>
            </div>

            {/* Минимальный рейтинг */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center justify-between">
                <span>Рейтинг TMDB</span>
                <span className="text-yellow-400 font-bold">
                  {minRating > 0 ? `от ${minRating.toFixed(1)} ★` : 'Любой'}
                </span>
              </label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
              >
                {RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Год выпуска */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Год релиза
              </label>
              <select
                value={yearFrom}
                onChange={(e) => setYearFrom(parseInt(e.target.value, 10))}
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
              >
                {YEAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Подсказка при высоком рейтинге */}
          {minRating >= 8.5 && (
            <div className="mb-5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs flex items-center gap-2">
              <span>💡</span>
              <span>
                На TMDB средний балл даже легендарных шедевров («Побег из Шоушенка», «Крёстный отец») редко превышает 8.7–8.8. Для более широкого поиска рекомендуем выставлять 7.5+ или 8.0+.
              </span>
            </div>
          )}

          {/* Жанры (Мультивыбор) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Жанры (нажмите, чтобы выбрать любое количество)
              </label>
              {selectedGenres.length > 0 && (
                <button
                  type="button"
                  onClick={clearGenres}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-sm border border-blue-400/40'
                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {genre.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              {selectedGenres.length === 0
                ? 'Выбраны все жанры'
                : `Будут найдены тайтлы, содержащие хотя бы один из ${selectedGenres.length} выбранных жанров`}
            </p>
          </div>

          {/* Кнопки поиска */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center gap-3">
            {activeTab === 'roulette' ? (
              <button
                onClick={spinRoulette}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Крутим рулетку...</span>
                  </>
                ) : (
                  <>
                    <span>🎲 Крутить ещё раз</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={fetchList}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Поиск тайтлов...</span>
                  </>
                ) : (
                  <>
                    <span>🔍 Найти подходящие</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Сообщение об ошибке / пустоте */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center text-red-300 max-w-xl mx-auto mb-8">
            <p className="text-base font-medium mb-2">Ничего не найдено</p>
            <p className="text-sm opacity-80">{errorMsg}</p>
            <button
              onClick={() => {
                setMinRating(7.0);
                setYearFrom(0);
                setSelectedGenres([]);
                if (activeTab === 'roulette') {
                  setTimeout(spinRoulette, 50);
                } else {
                  setTimeout(fetchList, 50);
                }
              }}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Сбросить фильтры к рекомендованным
            </button>
          </div>
        )}

        {/* 1. ВИД: РУЛЕТКА */}
        {activeTab === 'roulette' && (
          <div>
            {loading && !randomItem && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-3xl mx-auto animate-pulse flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 h-96 bg-neutral-800 rounded-2xl" />
                <div className="flex-1 space-y-4">
                  <div className="h-8 bg-neutral-800 rounded-lg w-3/4" />
                  <div className="h-4 bg-neutral-800 rounded w-1/2" />
                  <div className="h-24 bg-neutral-800 rounded-lg" />
                </div>
              </div>
            )}

            {!loading && randomItem && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden max-w-4xl mx-auto shadow-2xl relative">
                {/* Фоновый размытый бэкдроп */}
                {randomItem.backdropUrl && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-15 blur-xl pointer-events-none"
                    style={{ backgroundImage: `url(${randomItem.backdropUrl})` }}
                  />
                )}

                <div className="relative p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
                  {/* Постер */}
                  <div className="w-full md:w-72 flex-shrink-0">
                    <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-xl relative group">
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

                      {/* Бейдж типа контента */}
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-white border border-white/10">
                        {randomItem.type === 'movie' ? 'Фильм' : 'Сериал'}
                      </div>
                    </div>
                  </div>

                  {/* Описание тайтла */}
                  <div className="flex-1 flex flex-col h-full">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {randomItem.year}
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-sm">
                        <span>★</span>
                        <span>{randomItem.voteAverage.toFixed(1)}</span>
                        <span className="text-neutral-500 text-xs font-normal">
                          ({randomItem.voteCount} голосов)
                        </span>
                      </div>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
                      {randomItem.title}
                    </h2>

                    {randomItem.originalTitle && randomItem.originalTitle !== randomItem.title && (
                      <p className="text-sm text-neutral-400 mb-4 font-normal italic">
                        {randomItem.originalTitle}
                      </p>
                    )}

                    {/* Жанры */}
                    {randomItem.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {randomItem.genres.map((g) => (
                          <span
                            key={g}
                            className="text-xs px-2.5 py-1 rounded-md bg-neutral-800/80 text-neutral-300 border border-neutral-700/50"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Синопсис */}
                    <div className="text-sm text-neutral-300 leading-relaxed mb-6 line-clamp-6">
                      {randomItem.overview}
                    </div>

                    {/* Кнопки действий */}
                    <div className="mt-auto pt-4 border-t border-neutral-800/80 flex flex-wrap items-center gap-3">
                      <button
                        onClick={spinRoulette}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors flex items-center gap-2 shadow-md shadow-blue-600/20"
                      >
                        <span>🎲 Крутить ещё</span>
                      </button>

                      <Link
                        href={`https://www.themoviedb.org/${randomItem.type}/${randomItem.tmdbId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition-colors flex items-center gap-2 border border-neutral-700"
                      >
                        <span>Открыть на TMDB ↗</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. ВИД: ПОДБОРКА СПИСКОМ */}
        {activeTab === 'list' && (
          <div>
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="bg-neutral-900 rounded-2xl h-72 border border-neutral-800" />
                ))}
              </div>
            )}

            {!loading && itemsList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {itemsList.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group"
                  >
                    <div className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden">
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
                        {item.type === 'movie' ? 'Фильм' : 'Сериал'}
                      </div>

                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.voteAverage.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col">
                      <div className="text-[11px] text-neutral-500 mb-1">{item.year}</div>
                      <h3 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h3>
                      {item.genres.length > 0 && (
                        <div className="text-[11px] text-neutral-400 line-clamp-1 mt-1">
                          {item.genres.slice(0, 2).join(', ')}
                        </div>
                      )}

                      <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs">
                        <Link
                          href={`https://www.themoviedb.org/${item.type}/${item.tmdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          TMDB ↗
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}