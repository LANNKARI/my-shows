'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EpisodeItem {
  id: number;
  season: number;
  episode: number;
  watched: boolean;
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

  const [dubbing, setDubbing] = useState<string>('');
  const [watchSite, setWatchSite] = useState<string>('');
  const [status, setStatus] = useState<string>('watching');
  const [userRating, setUserRating] = useState<number>(0);
  const [savingNotes, setSavingNotes] = useState<boolean>(false);

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

      setDubbing(json.userShow.dubbing || '');
      setWatchSite(json.userShow.watchSite || '');
      setStatus(json.userShow.status || 'watching');
      setUserRating(json.userShow.userRating || 0);
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

  // Быстрое переключение «Любимый сериал» прямо в трекере
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
      console.error('Ошибка сохранения избранного:', err);
    }
  };

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
      const newPercent = total > 0 ? Math.round((newWatchedTotal / total) * 100) : 0;

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
      console.error('Ошибка сохранения серии:', err);
    }
  };

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
      const newPercent = total > 0 ? Math.round((totalWatched / total) * 100) : 0;

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
      console.error('Ошибка отметки сезона:', err);
    }
  };

  const saveNotes = async (newStatus?: string) => {
    const targetStatus = newStatus || status;
    setSavingNotes(true);
    try {
      await fetch(`/api/user-shows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          dubbing,
          watchSite,
          score: userRating > 0 ? userRating : undefined,
        }),
      });
      if (newStatus) setStatus(newStatus);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении заметок');
    } finally {
      setSavingNotes(false);
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
      {/* Шапка трекера */}
      <div className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Назад</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Кнопка «Любимый сериал» в шапке */}
            <button
              onClick={toggleFavorite}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all border flex items-center gap-1.5 ${
                isFav
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
            >
              <span>{isFav ? '★' : '☆'}</span>
              <span>{isFav ? 'Любимый сериал' : 'Сделать любимым'}</span>
            </button>

            <Link
              href={`/show/${show.id}`}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Карточка фильма ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-8">
        {/* Карточка тайтла и шкала прогресса */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-28 sm:w-36 flex-shrink-0 mx-auto sm:mx-0">
            <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-lg">
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
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {show.year && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                    {show.year}
                  </span>
                )}
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {show.kind === 'series' ? 'Сериал' : 'Фильм'}
                </span>

                {isFav && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    ★ В профиле
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
                {show.title}
              </h1>

              {show.originalTitle && show.originalTitle !== show.title && (
                <p className="text-xs text-neutral-400 italic mb-4">
                  {show.originalTitle}
                </p>
              )}
            </div>

            {/* Прогресс-бар */}
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-neutral-200">
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
        </div>

        {/* Панель персональных настроек и заметок */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📝 Заметки и статус</span>
            </h2>
            <button
              onClick={() => saveNotes()}
              disabled={savingNotes}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              {savingNotes ? 'Сохранение...' : 'Сохранить заметки'}
            </button>
          </div>

          {/* Статус */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'watching', label: '👀 Смотрю' },
              { key: 'planned', label: '🔖 В планах' },
              { key: 'completed', label: '✓ Просмотрено' },
              { key: 'dropped', label: '✕ Брошено' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => saveNotes(st.key)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                  status === st.key
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Озвучка / Перевод:
              </label>
              <input
                type="text"
                value={dubbing}
                onChange={(e) => setDubbing(e.target.value)}
                placeholder="Например: LostFilm, Red Head Sound, Дубляж"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Где смотрю (сайт / сервис):
              </label>
              <input
                type="text"
                value={watchSite}
                onChange={(e) => setWatchSite(e.target.value)}
                placeholder="Например: Кинопоиск, Иви, HDRezka"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Личная оценка */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80 text-xs">
            <span className="text-neutral-400">Личная оценка:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  onClick={() => {
                    setUserRating(star);
                    fetch(`/api/user-shows/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ score: star }),
                    });
                  }}
                  className={`text-sm transition-transform hover:scale-125 ${
                    userRating >= star ? 'text-amber-400' : 'text-neutral-700 hover:text-neutral-400'
                  }`}
                  title={`${star} из 10`}
                >
                  ★
                </button>
              ))}
            </div>
            {userRating > 0 && (
              <span className="font-bold text-amber-400 ml-1">{userRating}/10</span>
            )}
          </div>
        </div>

        {/* СПИСОК СЕЗОНОВ И СЕРИЙ С ЧЕКБОКСАМИ */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📺 Эпизоды по сезонам</span>
          </h2>

          {seasons.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-500">
              Список серий для этого тайтла формируется...
            </div>
          ) : (
            seasons.map((season) => (
              <div
                key={season.seasonNumber}
                className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Шапка сезона */}
                <div className="p-4 bg-neutral-850/80 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-white">
                      Сезон {season.seasonNumber}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">
                      ({season.watchedEpisodes} из {season.totalEpisodes} просмотрено)
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      toggleSeasonAll(season.seasonNumber, !season.isCompleted)
                    }
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                      season.isCompleted
                        ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750'
                        : 'bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30'
                    }`}
                  >
                    {season.isCompleted ? 'Снять отметки сезона' : '✓ Отметить весь сезон'}
                  </button>
                </div>

                {/* Сетка серий с чекбоксами */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {season.episodes.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => toggleEpisode(ep.id, ep.watched)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                        ep.watched
                          ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-sm'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">
                          {ep.watched ? '☑' : '☐'}
                        </span>
                        <span className="text-xs font-bold">
                          {ep.episode} сер.
                        </span>
                      </div>
                      <span className="text-[10px] opacity-70">
                        {ep.watched ? 'Просмотрено' : 'Не смотрел'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}