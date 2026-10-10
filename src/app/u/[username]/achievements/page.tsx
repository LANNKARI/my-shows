'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AchievementItem } from '@/lib/achievements';

export default function UserAchievementsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAchievements = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/${username}`);
        if (!res.ok) {
          throw new Error('Не удалось загрузить достижения');
        }
        const data = await res.json();
        setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [username]);

  const unlockedList = achievements.filter((a) => a.unlocked);
  const inProgressList = achievements.filter((a) => !a.unlocked);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'legend':
        return 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10 shadow-sm shadow-fuchsia-400/20';
      case 'gold':
        return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
      case 'silver':
        return 'text-neutral-300 border-neutral-400/30 bg-neutral-400/10';
      default:
        return 'text-amber-600 border-amber-600/30 bg-amber-600/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Загрузка наград...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-xl">
          <div className="text-4xl mb-3">🎖️</div>
          <h1 className="text-xl font-bold text-white mb-2">Ошибка</h1>
          <p className="text-sm text-neutral-400 mb-6">{error}</p>
          <Link
            href={`/u/${username}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            ← Вернуться в профиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <Link
            href={`/u/${username}`}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors mb-3"
          >
            <span>← Профиль @{username}</span>
          </Link>

          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <span>🏆 Достижения</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Получено <strong className="text-white font-bold">{unlockedList.length}</strong> из {achievements.length}
          </p>
        </div>

        {/* 1. ПОЛУЧЕННЫЕ НАГРАДЫ */}
        {unlockedList.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              ПОЛУЧЕННЫЕ ({unlockedList.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unlockedList.map((ach) => (
                <div
                  key={ach.id}
                  className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex flex-col justify-between shadow-md"
                >
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 flex-shrink-0 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ach.icon}
                        alt={ach.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-white truncate mb-0.5">
                        {ach.title}
                      </h3>
                      <p className="text-xs text-neutral-400 leading-snug">
                        {ach.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${getTierColor(
                        ach.tier
                      )}`}
                    >
                      {ach.tierLabel}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span>✓</span>
                      <span>Получено</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. В ПРОЦЕССЕ */}
        {inProgressList.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              В ПРОЦЕССЕ ({inProgressList.length})
            </h2>

            <div className="space-y-2.5">
              {inProgressList.map((ach) => {
                const percent = Math.min(100, Math.round((ach.progress / ach.maxProgress) * 100));

                return (
                  <div
                    key={ach.id}
                    className="p-3.5 bg-neutral-900/50 border border-neutral-800/90 rounded-2xl flex items-center gap-4 hover:border-neutral-700 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800/80 flex-shrink-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ach.icon}
                        alt={ach.title}
                        className="w-full h-full object-cover grayscale opacity-40 contrast-75"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-white truncate">
                          {ach.title}{' '}
                          <span className="font-normal text-neutral-500 text-[11px]">
                            {ach.progress} / {ach.maxProgress}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getTierColor(
                            ach.tier
                          )}`}
                        >
                          {ach.tierLabel}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800/60">
                        <div
                          className="h-full bg-red-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-neutral-400">
                        {ach.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}