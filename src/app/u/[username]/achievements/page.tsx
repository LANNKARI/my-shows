"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  progress: { current: number; target: number };
  unlocked: boolean;
};

type Data = {
  all: Achievement[];
  unlocked: Achievement[];
  inProgress: Achievement[];
};

const TIER_LABELS: Record<Achievement["tier"], string> = {
  bronze: "Бронза",
  silver: "Серебро",
  gold: "Золото",
  legendary: "Легенда",
};

const TIER_STYLES: Record<Achievement["tier"], string> = {
  bronze: "from-amber-700 to-amber-900 border-amber-600/40",
  silver: "from-neutral-400 to-neutral-600 border-neutral-300/40",
  gold: "from-yellow-400 to-yellow-600 border-yellow-300/40",
  legendary: "from-purple-500 to-pink-600 border-purple-300/40",
};

export default function AchievementsPage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${username}/achievements`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        setData(await r.json());
      })
      .catch(() => setNotFound(true));
  }, [username]);

  if (notFound) {
    return (
      <div className="text-center py-24">
        <p className="text-neutral-500 text-lg mb-4">Пользователь не найден</p>
        <Link href="/" className="btn btn-primary">
          На главную
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-neutral-500">Загрузка...</p>;

  const { all, unlocked } = data;
  const locked = all.filter((a) => !a.unlocked);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Заголовок */}
      <div>
        <Link
          href={`/u/${username}`}
          className="text-sm text-neutral-500 hover:text-white transition"
        >
          ← Профиль @{username}
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-3">
          🏆 Достижения
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Получено{" "}
          <span className="text-white font-semibold">
            {unlocked.length}
          </span>{" "}
          из {all.length}
        </p>
      </div>

      {/* Полученные */}
      {unlocked.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-3">
            Полученные ({unlocked.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unlocked.map((a) => (
              <div
                key={a.id}
                className={`card p-4 border bg-gradient-to-br ${TIER_STYLES[a.tier]} bg-opacity-10`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-2xl shrink-0">
                    {a.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{a.name}</div>
                    <div className="text-xs text-white/70">
                      {a.description}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-widest font-bold opacity-80">
                  {TIER_LABELS[a.tier]}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* В процессе */}
      {data.inProgress.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-3">
            В процессе ({data.inProgress.length})
          </h2>
          <div className="space-y-2">
            {data.inProgress.map((a) => {
              const percent = Math.min(
                100,
                (a.progress.current / a.progress.target) * 100
              );
              return (
                <div
                  key={a.id}
                  className="card p-4 bg-neutral-900/40 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-xl shrink-0">
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-neutral-500">
                        {a.progress.current} / {a.progress.target}
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">
                      {a.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Заблокированные */}
      {locked.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-3">
            Заблокированные ({locked.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {locked.map((a) => (
              <div
                key={a.id}
                className="card p-4 bg-neutral-900/20 border border-white/5 opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center text-2xl grayscale shrink-0">
                    {a.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-neutral-400">
                      {a.name}
                    </div>
                    <div className="text-xs text-neutral-600">
                      {a.description}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-widest font-bold text-neutral-700">
                  {TIER_LABELS[a.tier]}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}