'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface UserProfileData {
  user: {
    id: string;
    username: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  completedShows: {
    id: number;
    showId: number;
    name: string;
    posterUrl: string | null;
    year: string | null;
    kind: string;
    rating: number | null;
  }[];
  stats: {
    totalCompleted: number;
  };
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

  useEffect(() => {
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки профиля';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

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

  if (error || !data) {
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

  const { user, completedShows, stats } = data;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Шапка профиля */}
      <div className="border-b border-neutral-800 bg-neutral-900/60">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center text-3xl font-bold text-neutral-300 overflow-hidden flex-shrink-0 shadow-xl">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>

          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {user.name || user.username}
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">@{user.username}</p>
            {user.bio && (
              <p className="text-xs text-neutral-300 mt-2 max-w-lg leading-relaxed">{user.bio}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-400">
              <span className="px-3 py-1 bg-neutral-800 rounded-xl border border-neutral-700">
                ✓ Просмотрено: <strong className="text-white">{stats.totalCompleted}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Список просмотренных фильмов и сериалов */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <span>✓ Просмотренные тайтлы</span>
          <span className="text-xs font-normal text-neutral-500">({completedShows.length})</span>
        </h2>

        {completedShows.length === 0 ? (
          <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl text-xs text-neutral-500">
            В списке просмотренного пока ничего нет.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {completedShows.map((item) => (
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
                      Нет постера
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
                  {item.year && (
                    <div className="text-[11px] text-neutral-500 mb-1">{item.year}</div>
                  )}
                  <Link
                    href={`/show/${item.showId}`}
                    className="font-semibold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition-colors block"
                  >
                    {item.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}