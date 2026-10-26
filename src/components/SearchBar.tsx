'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavigationIcon from './NavigationIcon';

interface SearchResultItem {
  id: number; tmdbId?: number; showId?: number; title: string; name?: string;
  year?: string; posterUrl?: string | null; rating?: number;
  kind?: string; type?: string; media_type?: string;
}
type SearchState = { query: string; items: SearchResultItem[]; loading: boolean; error: string | null };

export default function SearchBar({ layout = 'dropdown', autoFocus = false }: { layout?: 'dropdown' | 'page'; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectingRef = useRef(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const normalized = query.trim();
  const current = state?.query === normalized ? state : null;
  const loading = Boolean(normalized) && (!current || current.loading);
  const results = current?.items || [];
  const page = layout === 'page';

  useEffect(() => {
    if (!normalized) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ query: normalized, items: [], loading: true, error: null });
      try {
        const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Поиск временно недоступен. Попробуйте ещё раз.');
        const data = await response.json();
        if (!controller.signal.aborted) setState({ query: normalized, items: Array.isArray(data.results) ? data.results : [], loading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({ query: normalized, items: [], loading: false, error: error instanceof Error ? error.message : 'Не удалось выполнить поиск.' });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized, retry]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  const handleSelect = async (item: SearchResultItem) => {
    if (selectingRef.current) return;
    const targetId = item.tmdbId || item.id || item.showId;
    if (!targetId) return;
    selectingRef.current = true;
    setSelecting(true);
    const mediaType = item.type || item.media_type || (item.kind === 'series' ? 'tv' : 'movie');
    let finalId = targetId;
    try {
      const response = await fetch('/api/tmdb/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: targetId, type: mediaType }), signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        finalId = data.show?.id || data.id || targetId;
      }
    } catch {
      // Карточка также поддерживает загрузку по TMDB ID и типу.
    } finally {
      selectingRef.current = false;
      setSelecting(false);
    }
    setIsOpen(false);
    router.push(`/show/${finalId}?type=${encodeURIComponent(mediaType)}`);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${page ? '' : 'max-w-md'}`}>
      <div role="search">
        <label htmlFor={id} className="sr-only">Поиск фильмов и сериалов</label>
        <div className="relative flex items-center">
          <NavigationIcon name="search" className="pointer-events-none absolute left-3 h-5 w-5 text-neutral-400" />
          <input id={id} ref={inputRef} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoFocus={autoFocus}
            value={query} aria-describedby={`${id}-status`} aria-controls={`${id}-results`}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsOpen(false);
              if (e.key === 'ArrowDown' && results.length) {
                e.preventDefault();
                containerRef.current?.querySelector<HTMLButtonElement>('[data-search-result]')?.focus();
              }
            }}
            placeholder="Поиск фильмов и сериалов…"
            className={`site-search-input w-full rounded-xl border border-neutral-800 bg-neutral-900/90 pl-11 pr-11 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 ${page ? 'py-3.5' : 'py-2 md:text-sm'}`} />
          {normalized && <button type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-lg text-xl text-neutral-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400">×</button>}
        </div>
      </div>
      <p id={`${id}-status`} role="status" className={page ? 'mt-3 text-sm text-neutral-400' : 'sr-only'}>
        {selecting ? 'Открываем карточку…' : loading ? 'Ищем фильмы и сериалы…' : current?.error ? 'Не удалось выполнить поиск.' : normalized && current ? `Найдено: ${results.length}` : page ? 'Введите название фильма или сериала' : ''}
      </p>
      {(page || isOpen) && normalized && (
        <div id={`${id}-results`} className={page ? 'mt-5 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50' : 'absolute inset-x-0 top-full z-50 mt-2 max-h-[min(24rem,60dvh)] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl'}>
          {current?.error ? <div className="space-y-3 p-5"><p role="alert" className="text-sm text-neutral-300">{current.error}</p><button type="button" onClick={() => { setState({ query: normalized, items: [], loading: true, error: null }); setRetry(value => value + 1); }} className="min-h-11 rounded-lg px-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10">Повторить поиск</button></div>
            : loading ? <p className="p-5 text-sm text-neutral-400">Ищем…</p>
            : results.length === 0 ? <div className="p-5"><p className="text-sm font-medium text-neutral-200">Ничего не найдено</p><p className="mt-1 text-sm text-neutral-400">Проверьте название или попробуйте оригинальное.</p></div>
            : <ul aria-label="Результаты поиска" className="divide-y divide-neutral-800/60">
              {results.map(item => {
                const title = item.title || item.name || 'Без названия';
                const isSeries = item.type === 'tv' || item.media_type === 'tv' || item.kind === 'series';
                return <li key={`${item.id}-${item.type || item.media_type || item.kind}`}>
                  <button data-search-result type="button" disabled={selecting} onClick={() => void handleSelect(item)}
                    className="group flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-neutral-800/70 focus-visible:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rose-400 disabled:opacity-60">
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : <span className="flex h-full items-center justify-center text-neutral-500">🎞</span>}
                    </div>
                    <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold text-neutral-100 group-hover:text-rose-400">{title}</p><p className="mt-1 text-xs text-neutral-400">{isSeries ? 'Сериал' : 'Фильм'}{item.year ? ` · ${item.year}` : ''}{item.rating && item.rating > 0 ? ` · ★ ${item.rating.toFixed(1)}` : ''}</p></div>
                    <span aria-hidden="true" className="text-neutral-500">→</span>
                  </button>
                </li>;
              })}
            </ul>}
        </div>
      )}
      {page && !normalized && <div className="mt-8 rounded-2xl border border-dashed border-neutral-800 p-8 text-center"><NavigationIcon name="search" className="mx-auto mb-4 h-8 w-8 text-neutral-500" /><p className="font-medium text-neutral-200">Что хочется посмотреть?</p><p className="mt-2 text-sm leading-relaxed text-neutral-400">Введите знакомое название — найдём фильм, сериал или новую историю для вашего списка.</p></div>}
    </div>
  );
}
