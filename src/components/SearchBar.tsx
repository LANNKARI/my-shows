'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResultItem {
  id: number;
  tmdbId?: number;
  showId?: number;
  title: string;
  name?: string;
  originalTitle?: string;
  year?: string;
  posterUrl?: string | null;
  rating?: number;
  kind?: string;
  type?: string;
  media_type?: string;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Поиск с задержкой (Debounce 300ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Ошибка поиска:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Клик по найденному тайтлу
  const handleSelect = async (item: SearchResultItem) => {
    const targetId = item.id || item.tmdbId || item.showId;
    if (!targetId) return;

    setIsOpen(false);
    setQuery('');

    const mediaType = item.type || item.media_type || (item.kind === 'series' ? 'tv' : 'movie');

    // Гарантируем наличие тайтла в базе через импорт
    try {
      const res = await fetch('/api/tmdb/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: targetId,
          type: mediaType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const finalId = data.show?.id || data.id || targetId;
        router.push(`/show/${finalId}`);
        return;
      }
    } catch {
      // Фолбэк на прямой переход
    }

    router.push(`/show/${targetId}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Поле ввода */}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-neutral-400 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Поиск фильмов и сериалов..."
          className="w-full pl-9 pr-8 py-2 bg-neutral-900/90 border border-neutral-800 focus:border-neutral-700 text-sm text-neutral-200 placeholder-neutral-500 rounded-xl outline-none transition-colors"
        />
        {loading && (
          <div className="absolute right-3 w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
        )}
      </div>

      {/* Выпадающий список результатов */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-neutral-800/60">
          {results.map((item) => {
            const isSeries = item.type === 'tv' || item.kind === 'series';
            const displayTitle = item.title || item.name;

            return (
              <button
                key={`${item.id}-${item.type || 'item'}`}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full p-3 flex items-center gap-3 text-left hover:bg-neutral-800/70 transition-colors group"
              >
                {/* Мини-постер */}
                <div className="w-10 h-14 bg-neutral-950 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-800">
                  {item.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.posterUrl}
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-600">
                      🎬
                    </div>
                  )}
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white truncate group-hover:text-blue-400 transition-colors">
                      {displayTitle}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 uppercase">
                      {isSeries ? 'Сериал' : 'Фильм'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                    {item.year && <span>{item.year}</span>}
                    {item.rating && item.rating > 0 ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                        ★ {item.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}