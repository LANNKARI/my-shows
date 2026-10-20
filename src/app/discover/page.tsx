'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface DiscoverResult {
  id: number;
  title: string;
  originalTitle: string;
  posterUrl: string | null;
  year: string;
  rating: number;
  voteCount: number;
  overview: string;
  kind: 'movie' | 'series';
  genres: string[];
}

export default function DiscoverPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);

  const [contentType, setContentType] = useState<'all' | 'movie' | 'tv'>('all');
  const [minRating, setMinRating] = useState('7.0');
  const [releaseYear, setReleaseYear] = useState('all');
  const [noAnime, setNoAnime] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const genresList = [
    'Боевик', 'Приключения', 'Фантастика', 'Фэнтези', 'Комедия',
    'Драма', 'Триллер', 'Детектив', 'Ужасы', 'Мелодрама', 'Криминал',
    'Мультфильм', 'Семейный', 'Военный', 'Документальный', 'История', 'Музыка', 'Вестерн'
  ];

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const handleSpin = async () => {
    setLoading(true);
    setTimeout(() => {
      setResult({
        id: 157336,
        title: 'Интерстеллар',
        originalTitle: 'Interstellar',
        posterUrl: 'https://image.tmdb.org/t/p/w500/nJUHX3XL1jMkk8honUZnUmudFb9.jpg',
        year: '2014',
        rating: 8.5,
        voteCount: 41545,
        overview: 'Когда засуха, пыльные бури и вымирание растений приводят человечество к продовольственному кризису, коллектив исследователей и учёных отправляется сквозь червоточину в путешествие, чтобы превзойти прежние ограничения для космических путешествий человека и найти планету с подходящими для жизни условиями.',
        kind: 'movie',
        genres: ['Приключения', 'Драма', 'Фантастика']
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 px-4 mt-4">
      {/* 1. НОВАЯ ШАПКА СО СКРУГЛЕНИЕМ */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
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

          <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800">
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-md flex items-center gap-2">
              <span>🎲</span> Рулетка
            </button>
            <button className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors">
              <span>📋</span> Подборка
            </button>
          </div>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Тип контента</label>
            <div className="flex bg-neutral-950 rounded-xl border border-neutral-800 p-1">
              {[{ id: 'all', label: 'Все' }, { id: 'movie', label: 'Фильмы' }, { id: 'tv', label: 'Сериалы' }].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setContentType(type.id as any)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    contentType === type.id ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex justify-between">
              <span>Рейтинг TMDB</span>
              <span className="text-amber-400">ОТ {minRating} ★</span>
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-neutral-600 appearance-none cursor-pointer"
            >
              <option value="8.0">8.0+ (Шедевры)</option>
              <option value="7.0">7.0+ (Хорошие)</option>
              <option value="6.0">6.0+ (Средние)</option>
              <option value="0">Любой</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Год релиза</label>
            <select
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-neutral-600 appearance-none cursor-pointer"
            >
              <option value="all">За все время</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2020-2024">2020-2024</option>
              <option value="2010-2019">2010-2019</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setNoAnime(!noAnime)}
            className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 px-4 py-2 rounded-xl hover:border-neutral-700 transition-colors"
          >
            <div className={`w-3 h-3 rounded-full ${noAnime ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-neutral-700'}`} />
            <span className="text-xs font-semibold text-neutral-300">Без аниме и мультиков</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${noAnime ? 'bg-neutral-800 text-white border-neutral-700' : 'bg-neutral-900 text-neutral-500 border-neutral-800'}`}>
              {noAnime ? 'ВКЛ' : 'ВЫКЛ'}
            </span>
          </button>
        </div>

        <div className="space-y-3 mb-8">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Жанры (по любому совпадению)</label>
          <div className="flex flex-wrap gap-2">
            {genresList.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedGenres.includes(g)
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSpin}
          disabled={loading}
          className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
        >
          <span className={loading ? 'animate-spin' : ''}>🎲</span>
          {loading ? 'Подбираем...' : result ? 'Крутить ещё раз' : 'Крутить рулетку'}
        </button>
      </div>

      {/* 3. КАРТОЧКА РЕЗУЛЬТАТА */}
      {result && (
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-48 sm:w-64 flex-shrink-0 mx-auto md:mx-0">
              <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-xl relative">
                {result.posterUrl && (
                  <img src={result.posterUrl} alt={result.title} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold uppercase text-white border border-white/10">
                  {result.kind === 'movie' ? 'Фильм' : 'Сериал'}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-300 font-bold text-xs border border-neutral-700">
                  {result.year}
                </span>
                <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs border border-amber-500/20 flex items-center gap-1.5">
                  <span>★ {result.rating}</span>
                  <span className="text-neutral-500 font-normal">({result.voteCount} оценок)</span>
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{result.title}</h2>
                <p className="text-sm text-neutral-400 italic mt-1">{result.originalTitle}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {result.genres.map(g => (
                  <span key={g} className="px-3 py-1 bg-neutral-800/60 border border-neutral-700/50 rounded-lg text-xs text-neutral-300">
                    {g}
                  </span>
                ))}
              </div>

              <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl pt-2">
                {result.overview}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-6">
                <button
                  onClick={handleSpin}
                  className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>🎲</span> Крутить ещё
                </button>
                <Link
                  href={`/show/${result.id}?type=${result.kind === 'series' ? 'tv' : 'movie'}`}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/30 hover:scale-[1.02] flex items-center gap-2"
                >
                  <span>🎬</span> Открыть на сайте
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}