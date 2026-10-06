"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Activity = {
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  title: {
    id: number;
    name: string;
    posterUrl: string | null;
    kind: string;
  };
  episode: {
    season: number;
    episode: number;
    watchedAt: string;
  };
  progress: {
    watched: number;
    total: number;
  };
};

function timeAgo(iso: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000
  );
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

export default function FriendsActivity() {
  const { status } = useSession();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    fetch("/api/friends/activity")
      .then((r) => (r.ok ? r.json() : []))
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, [status]);

  // Скрываем блок, если не авторизован, загружается или пусто
  if (status !== "authenticated") return null;
  if (loading) return null;
  if (activity.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          📺 Сейчас смотрят друзья
        </h2>
        <Link
          href="/friends"
          className="text-xs text-neutral-500 hover:text-white transition"
        >
          Все друзья →
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
        {activity.map((a, idx) => (
          <Link
            key={`${a.user.id}-${a.title.id}-${idx}`}
            href={`/title/${a.title.id}`}
            className="group shrink-0 w-44 rounded-xl overflow-hidden border border-white/5 bg-neutral-900/40 hover:bg-neutral-900/70 hover:border-white/10 transition-all"
          >
            {/* Постер */}
            <div className="relative aspect-[2/3] bg-neutral-900">
              {a.title.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.title.posterUrl}
                  alt={a.title.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-700">
                  🎞️
                </div>
              )}

              {/* Аватарка друга поверх постера */}
              <div className="absolute top-2 left-2">
                <Link
                  href={`/u/${a.user.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block"
                >
                  {a.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.user.avatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border-2 border-black/60"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-[10px] font-bold border-2 border-black/60">
                      {(a.user.name || a.user.username)[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </div>

              {/* Прогресс */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600"
                  style={{
                    width: `${
                      a.progress.total > 0
                        ? (a.progress.watched / a.progress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Инфа */}
            <div className="p-2.5 space-y-1">
              <div className="text-xs font-semibold line-clamp-2 leading-tight text-neutral-100">
                {a.title.name}
              </div>
              <div className="text-[10px] text-neutral-500 line-clamp-1">
                {a.title.kind === "series"
                  ? `S${String(a.episode.season).padStart(2, "0")}E${String(
                      a.episode.episode
                    ).padStart(2, "0")}`
                  : "🎬 Фильм"}{" "}
                · {timeAgo(a.episode.watchedAt)}
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                @{a.user.username}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}