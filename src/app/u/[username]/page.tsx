'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface FavoriteShow {
  id: number;
  showId: number;
  rank: number;
  name: string;
  posterUrl: string | null;
  year: string | null;
  kind: string;
  rating: number | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  tierLabel: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

interface UserProfileData {
  user: {
    id: string;
    username: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl?: string | null;
    createdAt: string;
  };
  isOwnProfile?: boolean;
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  stats?: {
    totalCompleted: number;
    moviesCount: number;
    seriesCount: number;
    ratingsCount: number;
    hoursWatched: number;
  };
  favorites?: FavoriteShow[];
  achievements?: Achievement[];
  completedShows?: {
    id: number;
    showId: number;
    name: string;
    posterUrl: string | null;
    year: string | null;
    kind: string;
    rating: number | null;
  }[];
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [data, setData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [friendshipLoading, setFriendshipLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series'>('all');

  // Управление сворачиванием достижений (по умолчанию свернуто: только 4)
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState<boolean>(false);

  const [isBannerModalOpen, setIsBannerModalOpen] = useState<boolean>(false);
  const [bannerUrlInput, setBannerUrlInput] = useState<string>('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingBanner, setSavingBanner] = useState<boolean>(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${username}`);
      if (!res.ok) {
        throw new Error('Пользователь не найден');
      }
      const json = await res.json();
      setData(json);
      setBannerUrlInput(json.user?.bannerUrl || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки профиля';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleFriendshipAction = async () => {
    if (!data?.user) return;
    setFriendshipLoading(true);
    try {
      const currentStatus = data.friendshipStatus;

      if (currentStatus === 'none') {
        const res = await fetch('/api/friendships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: data.user.id, action: 'request' }),
        });
        if (res.ok) {
          setData((prev) => (prev ? { ...prev, friendshipStatus: 'pending_sent' } : prev));
        }
      } else if (currentStatus === 'pending_received') {
        const res = await fetch('/api/friendships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: data.user.id, action: 'accept' }),
        });
        if (res.ok) {
          setData((prev) => (prev ? { ...prev, friendshipStatus: 'friends' } : prev));
        }
      } else if (currentStatus === 'pending_sent' || currentStatus === 'friends') {
        const res = await fetch(`/api/friendships?userId=${data.user.id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setData((prev) => (prev ? { ...prev, friendshipStatus: 'none' } : prev));
        }
      }
    } catch (err) {
      console.error('Ошибка изменения дружбы:', err);
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleSaveBanner = async () => {
    setSavingBanner(true);
    try {
      let res;
      if (bannerFile) {
        const fd = new FormData();
        fd.append('file', bannerFile);
        res = await fetch(`/api/users/${username}/banner`, {
          method: 'POST',
          body: fd,
        });
      } else {
        res = await fetch(`/api/users/${username}/banner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bannerUrl: bannerUrlInput.trim() }),
        });
      }

      if (res.ok) {
        const result = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                user: { ...prev.user, bannerUrl: result.bannerUrl },
              }
            : prev
        );
        setIsBannerModalOpen(false);
        setBannerFile(null);
      } else {
        alert('Не удалось сохранить обложку');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении обложки');
    } finally {
      setSavingBanner(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">👤</div>
          <h1 className="text-xl font-bold text-white mb-2">Профиль не найден</h1>
          <p className="text-sm text-neutral-400 mb-6">{error || 'Пользователь не существует.'}</p>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const { user } = data;
  const stats = data.stats || {
    totalCompleted: 0,
    moviesCount: 0,
    seriesCount: 0,
    ratingsCount: 0,
    hoursWatched: 0,
  };
  const favorites: FavoriteShow[] = Array.isArray(data.favorites) ? data.favorites : [];
  const achievements: Achievement[] = Array.isArray(data.achievements) ? data.achievements : [];
  const completedShows = Array.isArray(data.completedShows) ? data.completedShows : [];
  const isOwnProfile = Boolean(data.isOwnProfile);
  const friendshipStatus = data.friendshipStatus || 'none';

  // Показываем только 4 штуки в свернутом режиме, либо все 16 при разворачивании
  const visibleAchievements = isAchievementsExpanded
    ? achievements
    : achievements.slice(0, 4);

  const filteredShows = completedShows.filter((s) => {
    if (activeTab === 'movies') return s.kind === 'movie';
    if (activeTab === 'series') return s.kind === 'series';
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      {/* Скругленная шапка профиля */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="relative rounded-3xl overflow-hidden border border-neutral-800 bg-neutral-900/80 shadow-2xl">
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {user.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.bannerUrl}
                alt="Profile cover"
                className="w-full h-full object-cover opacity-40 scale-105 blur-[1px]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 opacity-90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/40" />
          </div>

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setIsBannerModalOpen(true)}
              className="absolute top-4 right-4 z-30 px-3.5 py-2 rounded-xl bg-black/75 hover:bg-black/95 backdrop-blur-md border border-white/20 text-xs font-semibold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 shadow-xl cursor-pointer"
            >
              <span>📷</span>
              <span>{user.bannerUrl ? 'Изменить обложку' : 'Добавить обложку'}</span>
            </button>
          )}

          <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-neutral-800 border-2 border-neutral-700/80 flex items-center justify-center text-3xl font-bold text-neutral-300 overflow-hidden flex-shrink-0 shadow-2xl">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>

            <div className="text-center sm:text-left flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                    {user.name || user.username}
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">@{user.username}</p>
                </div>

                {!isOwnProfile && (
                  <button
                    type="button"
                    onClick={handleFriendshipAction}
                    disabled={friendshipLoading}
                    className={`self-center sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 shadow-sm cursor-pointer ${
                      friendshipStatus === 'friends'
                        ? 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-rose-500/50 hover:text-rose-400'
                        : friendshipStatus === 'pending_sent'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30'
                        : friendshipStatus === 'pending_received'
                        ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 shadow-emerald-600/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-600/20'
                    }`}
                  >
                    {friendshipLoading ? (
                      'Загрузка...'
                    ) : friendshipStatus === 'friends' ? (
                      <>
                        <span>👥</span>
                        <span>В друзьях (удалить)</span>
                      </>
                    ) : friendshipStatus === 'pending_sent' ? (
                      <>
                        <span>⏳</span>
                        <span>Заявка отправлена (отменить)</span>
                      </>
                    ) : friendshipStatus === 'pending_received' ? (
                      <>
                        <span>✓</span>
                        <span>Принять заявку</span>
                      </>
                    ) : (
                      <>
                        <span>➕</span>
                        <span>Добавить в друзья</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {user.bio && (
                <p className="text-xs text-neutral-300 mt-2 max-w-xl leading-relaxed">{user.bio}</p>
              )}

              {/* Счетчики */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                <span className="px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 text-neutral-300 flex items-center gap-1.5 shadow-sm">
                  <span>✓ Просмотрено:</span>
                  <strong className="text-white font-bold">{stats.totalCompleted}</strong>
                </span>

                <span className="px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 text-neutral-300 flex items-center gap-1.5 shadow-sm">
                  <span>🎬 Фильмов:</span>
                  <strong className="text-blue-400 font-bold">{stats.moviesCount}</strong>
                </span>

                <span className="px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 text-neutral-300 flex items-center gap-1.5 shadow-sm">
                  <span>📺 Сериалов:</span>
                  <strong className="text-indigo-400 font-bold">{stats.seriesCount}</strong>
                </span>

                <span className="px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 text-neutral-300 flex items-center gap-1.5 shadow-sm">
                  <span>★ Оценок:</span>
                  <strong className="text-amber-400 font-bold">{stats.ratingsCount}</strong>
                </span>

                <span className="px-3 py-1.5 bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 text-neutral-300 flex items-center gap-1.5 shadow-sm">
                  <span>⏱ Время:</span>
                  <strong className="text-emerald-400 font-bold">{stats.hoursWatched} ч</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* 1. БЛОК: ЛЮБИМЫЕ СЕРИАЛЫ И ФИЛЬМЫ */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⭐ Любимые сериалы и фильмы</span>
              <span className="text-xs font-normal text-neutral-500">
                ({favorites.length})
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Тайтлы, отмеченные кнопкой «Любимый сериал» в библиотеке
            </p>
          </div>

          {favorites.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl">
              <span className="text-3xl block mb-2">⭐</span>
              <p className="text-sm font-semibold text-neutral-300 mb-1">
                {isOwnProfile ? 'Вы пока не отметили любимые картины' : 'Пользователь пока не добавил любимые картины'}
              </p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {isOwnProfile
                  ? 'Нажмите кнопку «Любимый сериал» на карточке в библиотеке или трекере, и тайтл сразу появится здесь.'
                  : 'Здесь появятся любимые фильмы и сериалы пользователя.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {favorites.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-amber-400/50 transition-all flex flex-col group shadow-lg relative"
                >
                  <Link
                    href={`/show/${item.showId}`}
                    className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
                  >
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.posterUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                        🎬 Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-2 py-0.5 rounded text-[11px] font-black shadow-md">
                      #{item.rank}
                    </div>

                    {item.rating && item.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.rating}</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-3">
                    {item.year && <div className="text-[10px] text-neutral-500 mb-0.5">{item.year}</div>}
                    <Link
                      href={`/show/${item.showId}`}
                      className="font-semibold text-xs text-white line-clamp-1 group-hover:text-amber-400 transition-colors block"
                    >
                      {item.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. БЛОК: СВОРАЧИВАЕМЫЕ ДОСТИЖЕНИЯ (ПО УМОЛЧАНИЮ ТОЛЬКО 4 КАРТОЧКИ) */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏆 Достижения</span>
                <span className="text-xs font-normal text-neutral-500">
                  ({achievements.filter((a) => a.unlocked).length} из {achievements.length})
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isAchievementsExpanded
                  ? 'Отображены все 16 наград профиля'
                  : 'Свёрнуто до 4 основных наград'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Кнопка сворачивания/разворачивания до 4 наград */}
              {achievements.length > 4 && (
                <button
                  type="button"
                  onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{isAchievementsExpanded ? '▴ Свернуть до 4' : '▾ Показать все (16)'}</span>
                </button>
              )}

              <Link
                href={`/u/${username}/achievements`}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Подробнее →
              </Link>
            </div>
          </div>

          {/* Сетка: ровно 4 колонки (в свернутом виде — ровно 1 ряд из 4 карточек) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {visibleAchievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  ach.unlocked
                    ? 'bg-neutral-900/95 border-amber-500/40 text-white shadow-lg shadow-amber-500/5'
                    : 'bg-neutral-900/30 border-neutral-800/80 text-neutral-500 opacity-60'
                }`}
              >
                <div>
                  <div className="w-16 h-16 mb-3 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800/80 shadow-inner flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ach.icon}
                      alt={ach.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        ach.unlocked
                          ? 'scale-100 filter-none'
                          : 'grayscale opacity-35 contrast-75'
                      }`}
                    />
                  </div>

                  <h3 className="font-bold text-xs text-white line-clamp-1 mb-1">
                    {ach.title}
                  </h3>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                    {ach.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-neutral-800">
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className={ach.unlocked ? 'text-amber-400 font-semibold' : 'text-neutral-500'}>
                      {ach.unlocked ? '✓ Получено' : 'В процессе'}
                    </span>
                    <span className="font-bold text-neutral-300">
                      {ach.progress}/{ach.maxProgress}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/50">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ach.unlocked ? 'bg-amber-400' : 'bg-neutral-700'
                      }`}
                      style={{
                        width: `${Math.min(100, (ach.progress / ach.maxProgress) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. БЛОК: ПРОСМОТРЕННЫЕ КАРТИНЫ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>✓ Просмотренные картины</span>
              <span className="text-xs font-normal text-neutral-500">
                ({completedShows.length})
              </span>
            </h2>

            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 self-start sm:self-auto text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Все ({completedShows.length})
              </button>
              <button
                onClick={() => setActiveTab('movies')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'movies'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Фильмы ({stats.moviesCount})
              </button>
              <button
                onClick={() => setActiveTab('series')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'series'
                    ? 'bg-neutral-800 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Сериалы ({stats.seriesCount})
              </button>
            </div>
          </div>

          {filteredShows.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl text-xs text-neutral-500">
              В этой категории пока ничего нет.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredShows.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all flex flex-col group shadow-md"
                >
                  <Link
                    href={`/show/${item.showId}`}
                    className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden block"
                  >
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.posterUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">
                        🎬 Нет постера
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                      {item.kind === 'series' ? 'Сериал' : 'Фильм'}
                    </div>

                    {item.rating && item.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                        <span>★</span>
                        <span>{item.rating}</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-3">
                    {item.year && <div className="text-[11px] text-neutral-500 mb-0.5">{item.year}</div>}
                    <Link
                      href={`/show/${item.showId}`}
                      className="font-semibold text-xs text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                    >
                      {item.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Модальное окно настройки обложки */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📷 Обложка профиля</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  1. Прямая ссылка на изображение (URL):
                </label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... или ссылка на арт"
                  value={bannerUrlInput}
                  onChange={(e) => {
                    setBannerUrlInput(e.target.value);
                    setBannerFile(null);
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <div className="flex-1 border-t border-neutral-800" />
                <span>ИЛИ</span>
                <div className="flex-1 border-t border-neutral-800" />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  2. Загрузить файл с устройства:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setBannerFile(e.target.files[0]);
                      setBannerUrlInput('');
                    }
                  }}
                  className="w-full text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              {user.bannerUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setBannerUrlInput('');
                    setBannerFile(null);
                    handleSaveBanner();
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Удалить обложку
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveBanner}
                  disabled={savingBanner}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {savingBanner ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}