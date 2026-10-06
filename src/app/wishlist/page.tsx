"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type WishItem = {
  id: number;
  showId: number;
  name: string;
  originalName: string | null;
  posterUrl: string | null;
  kind: string;
  year: string | null;
  tmdbRating: number | null;
  status: string;
  updatedAt: string;
};

export default function WishlistPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/wishlist")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [status, router]);

  async function startWatching(userShowId: number) {
    setBusyId(userShowId);
    try {
      const r = await fetch(`/api/user-shows/${userShowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watching" }),
      });
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.id !== userShowId));
      } else {
        alert("Ошибка");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(userShowId: number) {
    if (!confirm("Удалить из планов?")) return;
    setBusyId(userShowId);
    try {
      await fetch(`/api/user-shows/${userShowId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== userShowId));
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading" || loading) {
    return <p className="text-neutral-500">Загрузка...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          👀 Хочу посмотреть
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Сериалы и фильмы, которые вы отложили на потом
          {items.length > 0 && ` · ${items.length}`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">
          <div className="text-6xl mb-4">👀</div>
          <p className="mb-1 text-lg text-neutral-300">Пока пусто</p>
          <p className="mb-6 text-sm">
            Найдите сериал или фильм через поиск и нажмите
            «👀 Хочу посмотреть»
          </p>
          <Link href="/" className="btn btn-primary">
            На главную
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
          {items.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl overflow-hidden border border-white/5 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-white/10 transition-all group"
            >
              <Link href={`/show/${t.showId}`} className="block">
                <div className="relative aspect-[2/3] bg-neutral-900 overflow-hidden">
                  {t.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.posterUrl}
                      alt={t.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-neutral-700 bg-gradient-to-br from-neutral-900 to-neutral-800">
                      🎞️
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                  <div className="absolute top-2 left-2 badge badge-dark bg-black/70 backdrop-blur px-2 py-1 text-[10px]">
                    👀 В планах
                  </div>

                  {t.tmdbRating != null && (
                    <div className="absolute top-2 right-2 badge badge-gold px-1.5 py-0.5 text-[10px] font-semibold">
                      ⭐ {t.tmdbRating.toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-3 space-y-2">
                <Link
                  href={`/show/${t.showId}`}
                  className="block text-sm font-medium line-clamp-2 leading-tight text-neutral-100 hover:text-red-400 transition-colors"
                >
                  {t.name}
                </Link>
                <div className="text-[10px] text-neutral-500">
                  {t.kind === "series" ? "📺 Сериал" : "🎬 Фильм"}
                  {t.year && ` · ${t.year}`}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => startWatching(t.id)}
                    disabled={busyId === t.id}
                    className="btn btn-primary text-xs flex-1 justify-center"
                  >
                    {busyId === t.id ? "..." : "📚 Смотрю"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(t.id)}
                    disabled={busyId === t.id}
                    className="btn btn-secondary text-xs shrink-0 px-2"
                    title="Убрать из планов"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}