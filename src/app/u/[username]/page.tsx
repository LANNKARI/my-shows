"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TitleCard, { TitleCardData } from "@/components/TitleCard";

type UserPublic = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type Stats = {
  totalTitles: number;
  completedTitles: number;
  totalSeries: number;
  totalMovies: number;
  avgRating: number | null;
};

type Collection = {
  id: number;
  name: string;
  items: { id: number }[];
};

type Data = {
  user: UserPublic;
  titles: TitleCardData[];
  favorites: TitleCardData[];
  collections: Collection[];
  stats: Stats;
  friendshipStatus: "none" | "pending_out" | "pending_in" | "friends" | "self";
  friendshipId: number | null;
};

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${username}`)
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

  const { user, titles, favorites, collections, stats } = data;

  return (
    <div className="space-y-8">
      {/* Шапка профиля */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Аватарка */}
          <div className="shrink-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border border-white/5"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-4xl font-bold text-white">
                {(user.name || user.username)[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Инфа */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {user.name || user.username}
            </h1>
            <p className="text-neutral-500 text-sm mt-1">@{user.username}</p>

            {/* Кнопка дружбы — только если это не свой профиль */}
            {data.friendshipStatus !== "self" && (
              <div className="mt-4">
                <FriendButton
                  userId={user.id}
                  initialStatus={data.friendshipStatus}
                />
              </div>
            )}

            {user.bio && (
              <p className="text-neutral-300 text-sm mt-4 whitespace-pre-wrap">
                {user.bio}
              </p>
            )}

            {/* Статистика */}
            <div className="flex flex-wrap gap-4 mt-5 text-sm">
              <div>
                <span className="text-neutral-500">Сериалов: </span>
                <span className="font-semibold">{stats.totalSeries}</span>
              </div>
              <div>
                <span className="text-neutral-500">Фильмов: </span>
                <span className="font-semibold">{stats.totalMovies}</span>
              </div>
              <div>
                <span className="text-neutral-500">Просмотрено: </span>
                <span className="font-semibold">{stats.completedTitles}</span>
              </div>
              {stats.avgRating != null && (
                <div>
                  <span className="text-neutral-500">Средняя оценка: </span>
                  <span className="font-semibold">
                    ⭐ {stats.avgRating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ★ Любимые сериалы — компактные карточки */}
      {favorites.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="text-yellow-400">★</span>
            Любимые сериалы
            <span className="text-neutral-500 font-normal text-sm">
              ({favorites.length}/5)
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {favorites.map((t) => (
              <FavoriteCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Коллекции */}
      {collections.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">Коллекции</h2>
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => (
              <span
                key={c.id}
                className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-neutral-300"
              >
                📁 {c.name} · {c.items.length}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Все сериалы */}
      <section>
        <h2 className="text-lg font-bold mb-4">
          Сериалы и фильмы{" "}
          <span className="text-neutral-500 font-normal">
            ({titles.length})
          </span>
        </h2>

        {titles.length === 0 ? (
          <p className="text-neutral-500 py-12 text-center">
            Пока нет добавленных сериалов
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
            {titles.map((t, i) => (
              <div
                key={t.id}
                className="animate-in"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <TitleCard t={t} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Кнопка дружбы на чужом профиле ---------- */
function FriendButton({
  userId,
  initialStatus,
}: {
  userId: string;
  initialStatus: "none" | "pending_out" | "pending_in" | "friends";
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function sendRequest() {
    setLoading(true);
    try {
      const r = await fetch("/api/friendships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (r.ok) {
        setStatus("pending_out");
      }
    } finally {
      setLoading(false);
    }
  }

  if (status === "friends") {
    return (
      <span className="badge badge-green px-3 py-1.5 text-sm">
        ✓ В друзьях
      </span>
    );
  }

  if (status === "pending_out") {
    return (
      <span className="badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5 text-sm text-neutral-300">
        Заявка отправлена
      </span>
    );
  }

  if (status === "pending_in") {
    return (
      <Link
        href="/friends"
        className="badge badge-gold px-3 py-1.5 text-sm hover:opacity-90 transition"
      >
        Входящая заявка — перейти в «Друзья»
      </Link>
    );
  }

  return (
    <button
      onClick={sendRequest}
      disabled={loading}
      className="btn btn-primary"
      type="button"
    >
      {loading ? "Отправляю..." : "+ Добавить в друзья"}
    </button>
  );
}

/* ---------- Компактная карточка "Любимый сериал" ---------- */
function FavoriteCard({
  t,
}: {
  t: {
    id: number;
    name: string;
    posterUrl?: string | null;
    avgRating?: number | null;
    isCompleted?: boolean;
    kind?: string;
    watchedEpisodes?: number;
    episodesCount?: number;
  };
}) {
  const progress =
    t.episodesCount && t.episodesCount > 0
      ? Math.min(100, ((t.watchedEpisodes ?? 0) / t.episodesCount) * 100)
      : 0;

  return (
    <Link
      href={`/title/${t.id}`}
      className="group block rounded-xl overflow-hidden border border-yellow-500/20 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-yellow-500/40 transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[2/3] bg-neutral-900 overflow-hidden">
        {t.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.posterUrl}
            alt={t.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
            🎞️
          </div>
        )}

        {/* Градиент снизу */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        {/* Оценка */}
        {t.avgRating != null && (
          <div className="absolute top-1.5 right-1.5 rounded-full bg-black/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300">
            ⭐ {t.avgRating.toFixed(1)}
          </div>
        )}

        {/* Мини-прогресс */}
        {t.kind === "series" && (t.episodesCount ?? 0) > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-2">
        <div className="text-xs font-medium line-clamp-2 leading-tight text-neutral-200 group-hover:text-yellow-300 transition-colors">
          {t.name}
        </div>
      </div>
    </Link>
  );
}