'use client';

import Link from 'next/link';
import { privateFetch } from '@/lib/private-fetch';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import NavigationIcon from './NavigationIcon';
import useQuickProgress, { type ProgressPatch } from './useQuickProgress';
import {
  filterLibrary,
  libraryProgress,
  libraryStatuses,
  personalRating,
  type LibraryItem,
} from '@/lib/library';

type Resource = {
  userId: string;
  attempt: number;
  items: LibraryItem[];
  error: string | null;
  unauthorized: boolean;
};
const control =
  'min-h-11 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-200 outline-none focus-visible:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500/20';
const primaryLink =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-rose-400';

function Poster({ item, large }: { item: LibraryItem; large: boolean }) {
  return (
    <div
      className={`${large ? 'aspect-[2/3] w-full' : 'h-24 w-16 sm:h-28 sm:w-20'} shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950`}
    >
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.posterUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-500">
          Нет постера
        </span>
      )}
    </div>
  );
}

function LibraryCard({
  item,
  posters,
  mark,
  disabled,
  saving,
  notice,
}: {
  item: LibraryItem;
  posters: boolean;
  mark: (item: LibraryItem) => void;
  disabled: boolean;
  saving: boolean;
  notice?: ReactNode;
}) {
  const progress = libraryProgress(item);
  const rating = personalRating(item);
  const cardHref = `/show/${item.showId}?type=${progress.movie ? 'movie' : 'tv'}`;
  const status =
    libraryStatuses.find((status) => status.value === item.status)?.label ||
    item.status;
  const subtitle =
    item.status === 'watching' && !progress.movie
      ? progress.next
        ? `Следующая: сезон ${progress.next.season}, серия ${progress.next.episode}`
        : progress.total > 0 && progress.watched >= progress.total
          ? 'Все доступные серии отмечены'
          : 'Откройте трекер, чтобы уточнить серии'
      : status;
  return (
    <article
      aria-label={item.title}
      className={`scroll-mt-20 rounded-2xl border border-neutral-800 bg-neutral-900/60 ${posters ? 'flex flex-col overflow-hidden' : 'grid grid-cols-[4rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:p-5'}`}
    >
      <div className={posters ? 'p-3 pb-0' : ''}>
        <Poster item={item} large={posters} />
      </div>
      <div
        className={`min-w-0 ${posters ? 'flex-1 space-y-3 p-3 sm:p-4' : 'space-y-2'}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
          <span>{progress.movie ? 'Фильм' : 'Сериал'}</span>
          {item.year && <span>· {item.year}</span>}
          {rating !== null && (
            <span
              className="text-amber-400"
              aria-label={`Моя оценка: ${rating}`}
            >
              ★ {rating}
            </span>
          )}
        </div>
        <Link
          href={cardHref}
          className="block text-base font-bold leading-snug text-neutral-100 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-rose-400 sm:text-lg"
        >
          {item.title}
        </Link>
        <p className="text-xs leading-relaxed text-neutral-400 sm:text-sm">
          {subtitle}
        </p>
        {!progress.movie && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap justify-between gap-1 text-xs text-neutral-400">
              <span>
                Отмечено: {progress.watched} из {progress.total || '—'} серий
              </span>
              {progress.percent !== null && <span>{progress.percent}%</span>}
            </div>
            {progress.percent !== null && (
              <div
                role="progressbar"
                aria-label={`Прогресс просмотра: ${item.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                className="h-1.5 overflow-hidden rounded-full bg-neutral-800"
              >
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
        {progress.stopped && item.status !== 'completed' && (
          <p className="inline-block rounded-lg border border-neutral-700 bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
            {!progress.movie && progress.stoppedEpisode
              ? `С${progress.stoppedEpisode.season} · Э${progress.stoppedEpisode.episode} · `
              : ''}
            Остановились на {progress.stopped.stoppedAt}
          </p>
        )}
        {notice}
      </div>
      <div
        className={
          posters
            ? 'px-3 pb-3 sm:px-4 sm:pb-4'
            : 'col-span-2 flex flex-wrap items-center gap-3 sm:col-span-1 sm:flex-col sm:items-stretch'
        }
      >
        {((progress.movie && ['watching', 'planned'].includes(item.status)) ||
          (!progress.movie && item.status === 'watching' && progress.next)) && (
          <button
            type="button"
            disabled={disabled}
            data-quick-progress={item.userShowId}
            aria-busy={saving}
            aria-label={`${progress.movie ? 'Отметить фильм просмотренным' : 'Отметить следующую серию'}: ${item.title}`}
            onClick={() => mark(item)}
            className={`min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-wait disabled:opacity-60 ${posters ? 'mb-2 w-full' : 'flex-1 sm:flex-none'}`}
          >
            {saving
              ? 'Сохраняем…'
              : progress.movie
                ? 'Просмотрено'
                : 'Отметить серию'}
          </button>
        )}
        <Link
          href={`/library/${item.showId}`}
          aria-label={`Открыть трекер: ${item.title}`}
          className={`${primaryLink} ${posters ? 'w-full' : 'flex-1 sm:flex-none'}`}
        >
          Открыть трекер
        </Link>
        {!posters && (
          <Link
            href={cardHref}
            aria-label={`О карточке: ${item.title}`}
            className="inline-flex min-h-11 items-center justify-center px-2 text-xs text-neutral-400 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            О карточке
          </Link>
        )}
      </div>
    </article>
  );
}

export default function Library() {
  const params = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id;
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource | null>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const status =
    libraryStatuses.find((status) => status.value === params.get('status')) ||
    libraryStatuses[0];
  const query = params.get('q') || '';
  const type = ['movie', 'series'].includes(params.get('type') || '')
    ? params.get('type')!
    : 'all';
  const sort = ['title', 'rating'].includes(params.get('sort') || '')
    ? params.get('sort')!
    : 'updated';
  const posters = params.get('view') === 'posters';
  const current =
    resource && resource.userId === userId && resource.attempt === attempt
      ? resource
      : null;
  const loading =
    sessionStatus === 'loading' ||
    (sessionStatus === 'authenticated' && !current);
  const items = current?.items || [];
  const applyProgress = useCallback(
    (patch: ProgressPatch) => {
      setResource((previous) =>
        previous && previous.userId === userId
          ? {
              ...previous,
              items: previous.items.map((item) =>
                item.userShowId === patch.userShowId
                  ? { ...item, ...patch }
                  : item,
              ),
            }
          : previous,
      );
    },
    [userId],
  );
  const quick = useQuickProgress(userId, applyProgress);
  const undoButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!quick.undo) return;
    const markButton = document.querySelector<HTMLButtonElement>(`[data-quick-progress="${quick.undo.id}"]`);
    if (document.activeElement !== document.body && document.activeElement !== markButton) return;
    (quick.undo.focus ? undoButton.current : markButton)?.focus({ preventScroll: true });
    const card = undoButton.current?.closest('article');
    if (card) {
      const rect = card.getBoundingClientRect();
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
      const bar = document.querySelector('nav[aria-label="Мобильная навигация"]')?.getBoundingClientRect();
      const bottom = bar?.height ? bar.top : window.innerHeight;
      if (rect.top < headerBottom || rect.bottom > bottom) card.scrollIntoView({ block: 'start' });
    }
  }, [quick.undo]);

  useEffect(() => {
    const nav = tabsRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active) return;
    const bounds = nav.getBoundingClientRect();
    const selected = active.getBoundingClientRect();
    if (selected.left < bounds.left)
      nav.scrollLeft += selected.left - bounds.left;
    else if (selected.right > bounds.right)
      nav.scrollLeft += selected.right - bounds.right;
  }, [status.value, current?.items.length]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !userId) return;
    const controller = new AbortController();
    privateFetch('/api/user-shows?status=library', controller.signal)
      .then(async (response) => {
        if (response.status === 401)
          return {
            userId,
            attempt,
            items: [],
            error: null,
            unauthorized: true,
          };
        if (!response.ok) throw new Error('library unavailable');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('invalid library');
        return {
          userId,
          attempt,
          items: data as LibraryItem[],
          error: null,
          unauthorized: false,
        };
      })
      .then((result) => {
        if (!controller.signal.aborted) setResource(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResource({
            userId,
            attempt,
            items: [],
            unauthorized: false,
            error: 'Не удалось загрузить библиотеку. Попробуйте ещё раз.',
          });
      });
    return () => controller.abort();
  }, [userId, sessionStatus, attempt]);

  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail?.source !== 'quick-progress')
        setAttempt((value) => value + 1);
    };
    window.addEventListener('user-shows-updated', refresh);
    return () => window.removeEventListener('user-shows-updated', refresh);
  }, []);

  const href = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (
        !value ||
        (key === 'status' && value === 'watching') ||
        (key === 'type' && value === 'all') ||
        (key === 'sort' && value === 'updated') ||
        (key === 'view' && value === 'list')
      )
        next.delete(key);
      else next.set(key, value);
    }
    return `/watching${next.size ? `?${next}` : ''}`;
  };
  const update = (changes: Record<string, string>) =>
    window.history.replaceState(null, '', href(changes));
  const visible = filterLibrary(items, status.value, query, type, sort);
  const statusCount = items.filter(
    (item) => item.status === status.value,
  ).length;

  const inlineUndo = Boolean(
    quick.undo &&
      !quick.error &&
      visible.some((item) => item.userShowId === quick.undo?.id),
  );
  const renderNotice = (inline: boolean) => (
    <aside
      aria-label="Последнее изменение прогресса"
      className={
        inline
          ? 'mt-3 space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3'
          : 'fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 space-y-3 rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl xl:inset-x-auto xl:bottom-5 xl:right-6 xl:w-96'
      }
    >
      {quick.error ? (
        <>
          <p role="alert" className="text-sm text-neutral-200">
            {quick.error}
          </p>
          <button
            type="button"
            disabled={Boolean(quick.pending)}
            onClick={() => {
              quick.dismiss();
              setAttempt((value) => value + 1);
            }}
            className={primaryLink}
          >
            Обновить библиотеку
          </button>
        </>
      ) : (
        quick.undo && (
          <>
            <p role="status" className="text-sm font-semibold text-neutral-100">
              {quick.undo.message}
            </p>
            {!inline && (
              <p className="line-clamp-2 text-xs text-neutral-400">
                {quick.undo.title} · Отмена доступна 10 минут
              </p>
            )}
          </>
        )
      )}
      <div className="flex flex-wrap gap-3">
        {quick.undo && (
          <button
            ref={undoButton}
            type="button"
            disabled={Boolean(quick.pending)}
            aria-label={`Отменить отметку: ${quick.undo.title}`}
            onClick={() => void quick.undoLast()}
            className={primaryLink}
          >
            {quick.pending?.action === 'undo' ? 'Отменяем…' : 'Отменить'}
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(quick.pending)}
          onClick={quick.dismiss}
          className="min-h-11 rounded-xl px-3 text-sm text-neutral-400 hover:text-white focus-visible:outline-2 focus-visible:outline-rose-400"
        >
          Закрыть
        </button>
      </div>
    </aside>
  );

  return (
    <section
      className={`space-y-6 ${(quick.undo || quick.error) && !inlineUndo ? 'pb-48' : 'pb-4'}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Моя библиотека
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Всё, что вы смотрите и хотите посмотреть.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/collections"
            className={`${control} inline-flex items-center`}
          >
            Коллекции
          </Link>
          <Link href="/search" className={primaryLink}>
            + Добавить
          </Link>
        </div>
      </header>
      {sessionStatus === 'unauthenticated' ||
      (sessionStatus === 'authenticated' && !userId) ||
      current?.unauthorized ? (
        <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">
            Войдите, чтобы открыть свою библиотеку
          </h2>
          <p className="text-sm text-neutral-400">
            Ваши списки, оценки и прогресс доступны только в вашем аккаунте.
          </p>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(href({}))}`}
            className={primaryLink}
          >
            Войти
          </Link>
        </div>
      ) : (
        <>
          <nav
            ref={tabsRef}
            aria-label="Статусы библиотеки"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {libraryStatuses.map((tab) => (
              <Link
                key={tab.value}
                href={href({ status: tab.value })}
                scroll={false}
                aria-current={status.value === tab.value ? 'page' : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-rose-400 ${status.value === tab.value ? 'border-rose-500/40 bg-rose-500/15 text-rose-400' : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-neutral-100'}`}
              >
                {tab.label}
                <span className="rounded-md bg-neutral-800/70 px-1.5 py-0.5 text-xs">
                  {current && !current.error
                    ? items.filter((item) => item.status === tab.value).length
                    : '—'}
                </span>
              </Link>
            ))}
          </nav>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <label htmlFor="library-search" className="sr-only">
                Поиск в моей библиотеке
              </label>
              <NavigationIcon
                name="search"
                className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-neutral-500"
              />
              <input
                id="library-search"
                type="search"
                maxLength={200}
                autoComplete="off"
                placeholder="Поиск в моей библиотеке"
                value={query}
                onChange={(event) => update({ q: event.target.value })}
                className={`${control} w-full pl-10 text-base sm:text-sm`}
              />
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <div className="min-w-0">
                <label htmlFor="library-type" className="sr-only">
                  Тип тайтла
                </label>
                <select
                  id="library-type"
                  value={type}
                  onChange={(event) => update({ type: event.target.value })}
                  className={`${control} w-full min-w-0`}
                >
                  <option value="all">Все типы</option>
                  <option value="movie">Фильмы</option>
                  <option value="series">Сериалы</option>
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="library-sort" className="sr-only">
                  Сортировка
                </label>
                <select
                  id="library-sort"
                  value={sort}
                  onChange={(event) => update({ sort: event.target.value })}
                  className={`${control} w-full min-w-0`}
                >
                  <option value="updated">По обновлению</option>
                  <option value="title">По названию</option>
                  <option value="rating">По моей оценке</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-xs text-neutral-400">
              {loading
                ? 'Загружаем библиотеку…'
                : current?.error
                  ? 'Библиотека недоступна'
                  : `Показано ${visible.length} из ${statusCount}`}
            </p>
            <div
              role="group"
              aria-label="Вид библиотеки"
              className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1"
            >
              {[
                { value: 'list', label: 'Список' },
                { value: 'posters', label: 'Постеры' },
              ].map((view) => (
                <button
                  key={view.value}
                  type="button"
                  aria-pressed={posters === (view.value === 'posters')}
                  onClick={() => update({ view: view.value })}
                  className={`min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-rose-400 ${posters === (view.value === 'posters') ? 'bg-rose-500/15 text-rose-400' : 'text-neutral-400 hover:text-neutral-100'}`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
          {current?.error ? (
            <div className="space-y-4 rounded-2xl border border-neutral-800 p-6">
              <p role="alert" className="text-sm text-neutral-300">
                {current.error}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className={primaryLink}
              >
                Повторить загрузку
              </button>
            </div>
          ) : loading ? (
            <div aria-label="Загрузка библиотеки" className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="h-36 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900/60"
                />
              ))}
            </div>
          ) : visible.length ? (
            <div
              aria-label="Тайтлы библиотеки"
              className={
                posters
                  ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  : 'space-y-3'
              }
            >
              {visible.map((item) => (
                <LibraryCard
                  key={item.userShowId}
                  item={item}
                  posters={posters}
                  notice={
                    inlineUndo && quick.undo?.id === item.userShowId
                      ? renderNotice(true)
                      : undefined
                  }
                  mark={(item) => void quick.mark(item)}
                  disabled={Boolean(quick.pending)}
                  saving={
                    quick.pending?.action === 'mark' &&
                    quick.pending.id === item.userShowId
                  }
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-neutral-800 p-6 text-center sm:p-10">
              <h2 className="text-lg font-semibold">
                {statusCount && (query.trim() || type !== 'all')
                  ? 'Ничего не найдено'
                  : status.empty}
              </h2>
              <p className="text-sm text-neutral-400">
                {statusCount && (query.trim() || type !== 'all')
                  ? 'Попробуйте другое название или сбросьте фильтры.'
                  : 'Добавляйте фильмы и сериалы, чтобы вести свою историю просмотра.'}
              </p>
              {statusCount && (query.trim() || type !== 'all') ? (
                <button
                  type="button"
                  onClick={() => update({ q: '', type: 'all' })}
                  className={primaryLink}
                >
                  Сбросить фильтры
                </button>
              ) : (
                <Link href="/search" className={primaryLink}>
                  Найти фильм или сериал
                </Link>
              )}
            </div>
          )}
        </>
      )}
      {(quick.error || quick.undo) &&
        !inlineUndo &&
        sessionStatus === 'authenticated' &&
        renderNotice(false)}
    </section>
  );
}
