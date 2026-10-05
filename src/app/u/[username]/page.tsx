"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TitleCard, { TitleCardData } from "@/components/TitleCard";
import Link from "next/link";

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
  collections: Collection[];
  stats: Stats;
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

  const { user, titles, collections, stats } = data;

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

      {/* Сериалы */}
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