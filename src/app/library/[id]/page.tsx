'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EpisodeItem {
  id: number;
  season: number;
  episode: number;
  watched: boolean;
  stoppedAt?: string | null;
}

interface SeasonItem {
  seasonNumber: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  isCompleted: boolean;
  episodes: EpisodeItem[];
}

interface TrackerData {
  userShow: {
    id: number;
    showId: number;
    status: string;
    kind: string;
    isFavorite?: boolean;
    dubbing: string | null;
    watchSite: string | null;
    userRating: number | null;
  };
  show: {
    id: number;
    title: string;
    originalTitle: string | null;
    posterUrl: string | null;
    year: string | null;
    kind: string;
    genres: string[];
    tmdbRating: number | null;
  };
  stats: {
    totalEpisodes: number;
    watchedEpisodesCount: number;
    progressPercent: number;
  };
  seasons: SeasonItem[];
}

export default function LibraryTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Состояния редактирования заметок
  const [isEditingDubbing, setIsEditingDubbing] = useState(false);
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [dubbingInput, setDubbingInput] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Состояние сворачивания сезонов (сезон -> открыт/закрыт)
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});

  // Редактирование времени остановки для конкретной серии
  const [editingEpisodeTimeId, setEditingEpisodeTimeId] = useState<number | null>(null);
  const [episodeTimeInput, setEpisodeTimeInput] = useState<string>('');

  const loadTracker = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-shows/${id}`);
      if (!res.ok) {
        throw new Error('Не удалось загрузить данные трекера');
      }
      const json: TrackerData = await res.json();
      setData(json);

      setDubbingInput(json.userShow.dubbing || '');
      setSiteInput(json.userShow.watchSite || '');

      // Инициализируем аккордеоны: первый незавершенный сезон открыт, остальные можно свернуть
      const initialOpen: Record<number, boolean> = {};
      let firstUncompletedFound = false;

      (json.seasons || []).forEach((s, idx) => {
        if (!firstUncompletedFound && !s.isCompleted) {
          initialOpen[s.seasonNumber] = true;
          firstUncompletedFound = true;
        } else if (idx === 0 && !firstUncompletedFound) {
          initialOpen[s.seasonNumber] = true;
        } else {
          initialOpen[s.seasonNumber] = !s.isCompleted;
        }
      });
      setOpenSeasons(initialOpen);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Переключение состояния аккордеона сезона
  const toggleSeasonAccordion = (seasonNumber: number) => {
    setOpenSeasons((prev) => ({
      ...prev,
      [seasonNumber]: !prev[seasonNumber],
    }));
  };

  const toggleAllSeasons = (open: boolean) => {
    if (!data) return;
    const nextState: Record<number, boolean> = {};
    data.seasons.forEach((s) => {
      nextState[s.seasonNumber] = open;
    });
    setOpenSeasons(nextState);
  };

  // Переключение избранного «Любимый сериал»
  const toggleFavorite = async () => {
    if (!data) return;
    const nextFavorite = !data.userShow.isFavorite;

    setData((prev) =>
      prev
        ? {
            ...prev,
            userShow: { ...prev.userShow, isFavorite: nextFavorite },
          }
        : prev
    );

    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: nextFavorite }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Переключение статуса просмотра (Смотрю, В планах и т.д.)
  const handleStatusChange = async (newStatus: string) => {
    if (!data) return;
    setData((prev) =>
      prev ? { ...prev, userShow: { ...prev.userShow, status: newStatus } } : prev
    );

    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Сохранение озвучки
  const handleSaveDubbing = async () => {
    setSavingNotes(true);
    try {
      const trimmed = dubbingInput.trim();
      await fetch(`/api/user-shows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dubbing: trimmed }),
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              userShow: { ...prev.userShow, dubbing: trimmed || null },
            }
          : prev
      );
      setIsEditingDubbing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  // Сохранение сайта просмотра
  const handleSaveSite = async () => {
    setSavingNotes(true);
    try {
      const trimmed = siteInput.trim();
      await fetch(`/api/user-shows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchSite: trimmed }),
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              userShow: { ...prev.userShow, watchSite: trimmed || null },
            }
          : prev
      );
      setIsEditingSite(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  // Форматирование ссылки на сайт просмотра
  const formatSiteLink = (site: string) => {
    const trimmed = site.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }
    // Если введено название («Кинопоиск», «HDRezka») — формируем ссылку для быстрого перехода
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed + ' ' + (data?.show.title || ''))}`;
  };

  // Переключение одной серии
  const toggleEpisode = async (episodeId: number, currentWatched: boolean) => {
    if (!data) return;
    const nextWatched = !currentWatched;

    setData((prev) => {
      if (!prev) return prev;
      let newWatchedTotal = prev.stats.watchedEpisodesCount;

      const newSeasons = prev.seasons.map((s) => {
        let seasonWatched = s.watchedEpisodes;
        const newEps = s.episodes.map((ep) => {
          if (ep.id === episodeId) {
            if (nextWatched) {
              seasonWatched += 1;
              newWatchedTotal += 1;
            } else {
              seasonWatched = Math.max(0, seasonWatched - 1);
              newWatchedTotal = Math.max(0, newWatchedTotal - 1);
            }
            return { ...ep, watched: nextWatched };
          }
          return ep;
        });

        return {
          ...s,
          watchedEpisodes: seasonWatched,
          isCompleted: seasonWatched === s.totalEpisodes && s.totalEpisodes > 0,
          episodes: newEps,
        };
      });

      const total = prev.stats.totalEpisodes;
      const newPercent = total > 0 ? Math.min(100, Math.round((newWatchedTotal / total) * 100)) : 0;

      return {
        ...prev,
        stats: {
          ...prev.stats,
          watchedEpisodesCount: newWatchedTotal,
          progressPercent: newPercent,
        },
        seasons: newSeasons,
      };
    });

    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          watched: nextWatched,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Отметка всего сезона
  const toggleSeasonAll = async (seasonNumber: number, markWatched: boolean) => {
    if (!data) return;

    setData((prev) => {
      if (!prev) return prev;
      const newSeasons = prev.seasons.map((s) => {
        if (s.seasonNumber === seasonNumber) {
          return {
            ...s,
            watchedEpisodes: markWatched ? s.totalEpisodes : 0,
            isCompleted: markWatched,
            episodes: s.episodes.map((ep) => ({ ...ep, watched: markWatched })),
          };
        }
        return s;
      });

      const totalWatched = newSeasons.reduce((acc, s) => acc + s.watchedEpisodes, 0);
      const total = prev.stats.totalEpisodes;
      const newPercent = total > 0 ? Math.min(100, Math.round((totalWatched / total) * 100)) : 0;

      return {
        ...prev,
        stats: {
          ...prev.stats,
          watchedEpisodesCount: totalWatched,
          progressPercent: newPercent,
        },
        seasons: newSeasons,
      };
    });

    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonNumber,
          markSeasonWatched: markWatched,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Сохранение времени остановки для серии
  const handleSaveEpisodeTime = async (episodeId: number) => {
    const trimmedTime = episodeTimeInput.trim();

    setData((prev) => {
      if (!prev) return prev;
      const newSeasons = prev.seasons.map((s) => ({
        ...s,
        episodes: s.episodes.map((ep) =>
          ep.id === episodeId ? { ...ep, stoppedAt: trimmedTime || null } : ep
        ),
      }));
      return { ...prev, seasons: newSeasons };
    });

    setEditingEpisodeTimeId(null);
    setEpisodeTimeInput('');

    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          stoppedAt: trimmedTime || null,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Загрузка трекера серий...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">🎬</div>
          <h1 className="text-xl font-bold text-white mb-2">Трекер не найден</h1>
          <p className="text-sm text-neutral-400 mb-6">{error || 'Не удалось найти серии для этого тайтла.'}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium rounded-xl transition-colors"
            >
              ← Назад
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { show, stats, seasons, userShow } = data;
  const isFav = Boolean(userShow.isFavorite);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      {/* Верхняя навигация */}
      <div className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Назад</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFavorite}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border flex items-center gap-1.5 ${
                isFav
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
              }`}
            >
              <span>{isFav ? '★' : '☆'}</span>
              <span>{isFav ? 'Любимый сериал' : 'Сделать любимым'}</span>
            </button>

            <Link
              href={`/show/${show.id}`}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800"
            >
              Карточка фильма ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ========================================================
              ЛЕВАЯ КОЛОНКА: БОЛЬШОЙ ПОСТЕР И КОМПАКТНЫЙ БЛОК ЗАМЕТОК
             ======================================================== */}
          <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-5">
            {/* 1. Большой постер тайтла */}
            <div className="aspect-[2/3] w-full rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl relative">
              {show.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={show.posterUrl}
                  alt={show.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
                  Нет постера
                </div>
              )}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-black uppercase text-white border border-white/10 tracking-wider">
                {show.kind === 'series' ? 'Сериал' : 'Фильм'}
              </div>
            </div>

            {/* 2. Компактный блок заметок и статуса строго под постером */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h2 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>📝 Заметки и статус</span>
              </h2>

              {/* Сетка 4 статусов просмотра */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'watching', label: '👀 Смотрю' },
                  { key: 'planned', label: '🔖 В планах' },
                  { key: 'completed', label: '✓ Просмотрено' },
                  { key: 'dropped', label: '✕ Брошено' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => handleStatusChange(st.key)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      userShow.status === st.key
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                        : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Озвучка и перевод */}
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-[11px] text-neutral-500 block mb-1">Озвучка / Перевод:</span>
                {isEditingDubbing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={dubbingInput}
                      onChange={(e) => setDubbingInput(e.target.value)}
                      placeholder="LostFilm, Red Head Sound, Дубляж..."
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveDubbing}
                        disabled={savingNotes}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg"
                      >
                        {savingNotes ? '...' : 'Сохранить'}
                      </button>
                      <button
                        onClick={() => {
                          setDubbingInput(userShow.dubbing || '');
                          setIsEditingDubbing(false);
                        }}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] rounded-lg"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : userShow.dubbing ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">🎧</span>
                      <span className="text-xs font-medium text-neutral-200 truncate">
                        {userShow.dubbing}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsEditingDubbing(true)}
                      className="text-neutral-500 hover:text-white text-xs p-1"
                      title="Изменить озвучку"
                    >
                      ✏️
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingDubbing(true)}
                    className="w-full py-2 px-3 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-xl text-xs text-neutral-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>+ Указать озвучку</span>
                  </button>
                )}
              </div>

              {/* Где смотрю (Сайт / Сервис) с красивой кликабельной ссылкой */}
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-[11px] text-neutral-500 block mb-1">Где смотрю:</span>
                {isEditingSite ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={siteInput}
                      onChange={(e) => setSiteInput(e.target.value)}
                      placeholder="Кинопоиск, HDRezka, Иви или ссылка..."
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveSite}
                        disabled={savingNotes}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg"
                      >
                        {savingNotes ? '...' : 'Сохранить'}
                      </button>
                      <button
                        onClick={() => {
                          setSiteInput(userShow.watchSite || '');
                          setIsEditingSite(false);
                        }}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] rounded-lg"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : userShow.watchSite ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800 group">
                    <a
                      href={formatSiteLink(userShow.watchSite)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-w-0 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Открыть сайт просмотра"
                    >
                      <span className="text-sm">🌐</span>
                      <span className="text-xs font-semibold underline truncate">
                        {userShow.watchSite}
                      </span>
                      <span className="text-[10px]">↗</span>
                    </a>
                    <button
                      onClick={() => setIsEditingSite(true)}
                      className="text-neutral-500 hover:text-white text-xs p-1"
                      title="Изменить сайт"
                    >
                      ✏️
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingSite(true)}
                    className="w-full py-2 px-3 border border-dashed border-neutral-800 hover:border-neutral-700 rounded-xl text-xs text-neutral-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>+ Указать сайт просмотра</span>
                  </button>
                )}
              </div>

              {/* Личная оценка */}
              <div className="pt-2 border-t border-neutral-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-500 text-[11px]">Моя оценка:</span>
                  {userShow.userRating && userShow.userRating > 0 && (
                    <span className="font-bold text-amber-400">{userShow.userRating}/10</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setData((prev) =>
                          prev
                            ? {
                                ...prev,
                                userShow: { ...prev.userShow, userRating: star },
                              }
                            : prev
                        );
                        fetch(`/api/user-shows/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ score: star }),
                        });
                      }}
                      className={`text-sm transition-transform hover:scale-125 ${
                        (userShow.userRating || 0) >= star
                          ? 'text-amber-400'
                          : 'text-neutral-700 hover:text-neutral-400'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              ПРАВАЯ КОЛОНКА: ИНФО, ПРОГРЕСС И СЕРИИ В СТРОЧКУ
             ======================================================== */}
          <div className="flex-1 w-full space-y-6">
            {/* Заголовок тайтла и Прогресс-бар */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {show.year && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                    {show.year}
                  </span>
                )}
                {show.tmdbRating && show.tmdbRating > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    ★ {show.tmdbRating.toFixed(1)} TMDB
                  </span>
                )}
                {show.genres && show.genres.length > 0 && (
                  <span className="text-xs text-neutral-400">
                    • {show.genres.slice(0, 3).join(', ')}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                {show.title}
              </h1>

              {show.originalTitle && show.originalTitle !== show.title && (
                <p className="text-xs text-neutral-400 italic mb-5">
                  {show.originalTitle}
                </p>
              )}

              {/* Прогресс-бар */}
              <div className="pt-4 border-t border-neutral-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-neutral-300">
                    Прогресс просмотра:
                  </span>
                  <span className="text-blue-400 font-bold">
                    {stats.watchedEpisodesCount} из {stats.totalEpisodes} серий ({stats.progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* СПИСОК СЕЗОНОВ (СВОРАЧИВАЕМЫЙ АККОРДЕОН) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📺 Эпизоды по сезонам</span>
                  <span className="text-xs font-normal text-neutral-500">
                    ({seasons.length} {seasons.length === 1 ? 'сезон' : 'сезонов'})
                  </span>
                </h2>

                {seasons.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => toggleAllSeasons(true)}
                      className="text-neutral-400 hover:text-white transition-colors"
                    >
                      Развернуть все
                    </button>
                    <span className="text-neutral-700">•</span>
                    <button
                      onClick={() => toggleAllSeasons(false)}
                      className="text-neutral-400 hover:text-white transition-colors"
                    >
                      Свернуть все
                    </button>
                  </div>
                )}
              </div>

              {seasons.length === 0 ? (
                <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-500">
                  Список серий для этого тайтла формируется...
                </div>
              ) : (
                seasons.map((season) => {
                  const isOpen = openSeasons[season.seasonNumber] ?? true;

                  return (
                    <div
                      key={season.seasonNumber}
                      className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg transition-all"
                    >
                      {/* Шапка сезона (кликабельный аккордеон) */}
                      <div className="p-4 bg-neutral-850/90 border-b border-neutral-800 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSeasonAccordion(season.seasonNumber)}
                          className="flex items-center gap-3 text-left flex-1 group"
                        >
                          <span className={`text-xs text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                            Сезон {season.seasonNumber}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium">
                            ({season.watchedEpisodes} из {season.totalEpisodes} просмотрено)
                          </span>
                          {season.isCompleted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ Завершен
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleSeasonAll(season.seasonNumber, !season.isCompleted)
                          }
                          className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border flex-shrink-0 ${
                            season.isCompleted
                              ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750'
                              : 'bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30'
                          }`}
                        >
                          {season.isCompleted ? 'Снять отметки сезона' : '✓ Отметить весь сезон'}
                        </button>
                      </div>

                      {/* Список серий в строчку (Row Format) */}
                      {isOpen && (
                        <div className="divide-y divide-neutral-800/60 p-2 sm:p-3">
                          {season.episodes.map((ep) => {
                            const isEditingTime = editingEpisodeTimeId === ep.id;

                            return (
                              <div
                                key={ep.id}
                                className={`p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                  ep.watched ? 'bg-blue-600/10' : 'hover:bg-neutral-850/60'
                                }`}
                              >
                                {/* Чекбокс и номер серии */}
                                <div className="flex items-center gap-3 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleEpisode(ep.id, ep.watched)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                                      ep.watched
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'border-neutral-700 bg-neutral-950 hover:border-blue-400'
                                    }`}
                                  >
                                    {ep.watched && <span className="text-xs">✓</span>}
                                  </button>

                                  <div>
                                    <span className="text-xs font-bold text-white block">
                                      Серия {ep.episode}
                                    </span>
                                    <span className="text-[11px] text-neutral-500">
                                      {ep.watched ? 'Просмотрено' : 'Не просмотрено'}
                                    </span>
                                  </div>
                                </div>

                                {/* Таймкод / Время остановки просмотра */}
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  {isEditingTime ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={episodeTimeInput}
                                        onChange={(e) => setEpisodeTimeInput(e.target.value)}
                                        placeholder="Например: 42:15"
                                        className="w-24 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveEpisodeTime(ep.id)}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingEpisodeTimeId(null);
                                          setEpisodeTimeInput('');
                                        }}
                                        className="px-2 py-1 bg-neutral-800 text-neutral-400 text-[11px] rounded-lg"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : ep.stoppedAt ? (
                                    <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded-xl">
                                      <span className="text-[11px] text-neutral-400">⏱ Ост.:</span>
                                      <span className="text-xs font-bold text-amber-400">
                                        {ep.stoppedAt}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingEpisodeTimeId(ep.id);
                                          setEpisodeTimeInput(ep.stoppedAt || '');
                                        }}
                                        className="text-neutral-500 hover:text-white text-[10px] ml-1"
                                        title="Изменить время"
                                      >
                                        ✏️
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEpisodeTimeId(ep.id);
                                        setEpisodeTimeInput('');
                                      }}
                                      className="text-[11px] text-neutral-500 hover:text-neutral-300 px-2 py-1 rounded-lg hover:bg-neutral-800 transition-colors"
                                    >
                                      + Время
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}