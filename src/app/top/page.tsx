'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface TopUser {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  score?: number;
  points?: number;
  completedCount?: number;
  showsCount?: number;
  ratingsCount?: number;
  commentsCount?: number;
  badges?: {
    id: string;
    title?: string;
    name?: string;
    icon: string;
  }[];
  achievements?: {
    id: string;
    title?: string;
    name?: string;
    icon: string;
  }[];
}

type TabType = 'active' | 'collectors' | 'critics' | 'commentators';

export default function TopPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [users, setUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/top');
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : data.users || []);
        }
      } catch (err) {
        console.error('Ошибка загрузки топа:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopUsers();
  }, []);

  // Сортировка участников в зависимости от выбранной вкладки
  const getSortedUsers = () => {
    const list = [...users];

    switch (activeTab) {
      case 'collectors':
        return list.sort(
          (a, b) =>
            (b.showsCount ?? b.completedCount ?? 0) -
            (a.showsCount ?? a.completedCount ?? 0)
        );
      case 'critics':
        return list.sort(
          (a, b) => (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0)
        );
      case 'commentators':
        return list.sort(
          (a, b) => (b.commentsCount ?? 0) - (a.commentsCount ?? 0)
        );
      case 'active':
      default:
        return list.sort(
          (a, b) =>
            (b.score ?? b.points ?? 0) - (a.score ?? a.points ?? 0)
        );
    }
  };

  const sortedUsers = getSortedUsers();

  const getScoreDisplay = (user: TopUser) => {
    switch (activeTab) {
      case 'collectors':
        return {
          val: user.showsCount ?? user.completedCount ?? 0,
          label: 'тайтлов',
        };
      case 'critics':
        return {
          val: user.ratingsCount ?? 0,
          label: 'оценок',
        };
      case 'commentators':
        return {
          val: user.commentsCount ?? 0,
          label: 'коммент.',
        };
      case 'active':
      default:
        return {
          val: user.score ?? user.points ?? 0,
          label: 'очков',
        };
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <span>🥇</span>
            <span>Топ пользователей</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Самые активные участники episyhub
          </p>
        </div>

        {/* Вкладки */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { key: 'active', label: '🏆 Активные' },
            { key: 'collectors', label: '📚 Коллекционеры' },
            { key: 'critics', label: '⭐ Критики' },
            { key: 'commentators', label: '💬 Комментаторы' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 rounded-2xl font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/20'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Список рейтинга */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-neutral-900/60 border border-neutral-800 rounded-3xl"
              />
            ))}
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-3xl text-xs text-neutral-500">
            В этой категории пока нет участников.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedUsers.map((user, index) => {
              const rank = index + 1;
              const { val, label } = getScoreDisplay(user);
              const userBadges = user.badges || user.achievements || [];

              const rankBg =
                rank === 1
                  ? 'bg-amber-400 text-black'
                  : rank === 2
                  ? 'bg-neutral-300 text-black'
                  : rank === 3
                  ? 'bg-amber-600 text-white'
                  : 'bg-neutral-800 text-neutral-400';

              return (
                <div
                  key={user.id || index}
                  className="p-4 bg-neutral-900/70 border border-neutral-800/90 hover:border-neutral-700 rounded-3xl flex items-center justify-between gap-4 transition-all shadow-md"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Ранг */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm ${rankBg}`}
                    >
                      {rank}
                    </div>

                    {/* Аватар */}
                    <Link
                      href={`/u/${user.username}`}
                      className="w-11 h-11 rounded-full bg-rose-600 flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0 overflow-hidden shadow-inner"
                    >
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatarUrl}
                          alt={user.name || user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (user.name || user.username || 'U')
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </Link>

                    {/* Имя и значки достижений */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/u/${user.username}`}
                          className="font-bold text-sm text-white hover:text-rose-400 transition-colors truncate"
                        >
                          {user.name || user.username}
                        </Link>

                        {/* Значки достижений */}
                        {userBadges.length > 0 && (
                          <div className="flex items-center gap-1">
                            {userBadges.slice(0, 4).map((badge, bIdx) => {
                              const bTitle =
                                badge.name || badge.title || 'Достижение';
                              const isImg =
                                badge.icon.startsWith('/') ||
                                badge.icon.includes('.') ||
                                badge.icon.startsWith('http');

                              return (
                                <div
                                  key={badge.id || bIdx}
                                  title={bTitle}
                                  className="w-5 h-5 rounded-full overflow-hidden bg-neutral-950 border border-amber-500/50 flex items-center justify-center flex-shrink-0 shadow-sm"
                                >
                                  {isImg ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={badge.icon}
                                      alt={bTitle}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] leading-none">
                                      {badge.icon}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-neutral-500 truncate">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  {/* Очки / Показатели */}
                  <div className="text-right flex-shrink-0 pl-2">
                    <span className="text-lg font-black text-white block tracking-tight leading-tight">
                      {val}
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Футер */}
        <div className="text-center pt-8 text-xs text-neutral-600">
          My Shows — личный трекер сериалов
        </div>
      </div>
    </div>
  );
}