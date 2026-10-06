"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AchievementBadges, { BadgeData } from "@/components/AchievementBadges";

type UserRow = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  metrics: {
    titles: number;
    ratings: number;
    comments: number;
    watchedEpisodes: number;
    completed: number;
    friends: number;
    score: number;
  };
  badges: BadgeData[];
};

type Category = "active" | "titles" | "ratings" | "comments";

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "active", label: "Активные", icon: "🏆" },
  { key: "titles", label: "Коллекционеры", icon: "📚" },
  { key: "ratings", label: "Критики", icon: "⭐" },
  { key: "comments", label: "Комментаторы", icon: "💬" },
];

function metricFor(u: UserRow, cat: Category): { value: number; label: string } {
  switch (cat) {
    case "titles":
      return { value: u.metrics.titles, label: "сериалов" };
    case "ratings":
      return { value: u.metrics.ratings, label: "оценок" };
    case "comments":
      return { value: u.metrics.comments, label: "комментариев" };
    default:
      return { value: u.metrics.score, label: "очков" };
  }
}

function positionStyle(pos: number): string {
  if (pos === 1)
    return "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black";
  if (pos === 2)
    return "bg-gradient-to-br from-neutral-300 to-neutral-500 text-black";
  if (pos === 3)
    return "bg-gradient-to-br from-amber-600 to-amber-800 text-white";
  return "bg-neutral-800 text-neutral-400";
}

export default function TopPage() {
  const [category, setCategory] = useState<Category>("active");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top?category=${category}`)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          🥇 Топ пользователей
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Самые активные участники episyhub
        </p>
      </div>

      {/* Табы */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
              category === c.key
                ? "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-900/40"
                : "bg-neutral-900 border border-white/5 text-neutral-400 hover:text-white hover:border-white/10"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <p className="text-neutral-500 text-center py-8">Загрузка...</p>
      ) : users.length === 0 ? (
        <p className="text-neutral-500 text-center py-12">
          Пока нет данных в этой категории
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => {
            const pos = i + 1;
            const metric = metricFor(u, category);
            const isTop3 = pos <= 3;

            return (
              <Link
                key={u.id}
                href={`/u/${u.username}`}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5 ${
                  isTop3
                    ? "border-yellow-500/20 bg-neutral-900/60 hover:border-yellow-500/40"
                    : "border-white/5 bg-neutral-900/40 hover:border-white/10"
                }`}
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${positionStyle(
                    pos
                  )}`}
                >
                  {pos}
                </div>

                <div className="shrink-0">
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white/5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
                      {(u.name || u.username)[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">
                      {u.name || u.username}
                    </span>
                    {u.badges && u.badges.length > 0 && (
                      <AchievementBadges
                        badges={u.badges}
                        max={3}
                        size="sm"
                      />
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    @{u.username}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums">
                    {metric.value}
                  </div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                    {metric.label}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}