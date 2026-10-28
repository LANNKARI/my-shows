"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { privateFetch } from "@/lib/private-fetch";
type Item = {
  showId: number;
  title: string;
  kind: string;
  posterUrl: string | null;
  next: { season: number; episode: number } | null;
  stoppedAt: string | null;
  total: number;
  watched: number;
  percent: number | null;
};
export default function ContinueWatching() {
  const { data } = useSession();
  return data?.user?.id ? <Shelf key={data.user.id} /> : null;
}
function Shelf() {
  const [items, setItems] = useState<Item[] | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    privateFetch("/api/continue-watching", c.signal)
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        if (!c.signal.aborted) {
          setItems(v);
          setError(false);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [attempt]);
  useEffect(() => {
    const f = () => setAttempt((v) => v + 1);
    window.addEventListener("user-shows-updated", f);
    return () => window.removeEventListener("user-shows-updated", f);
  }, []);
  if (items?.length === 0 && !error) return null;
  return (
    <section aria-labelledby="continue-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="continue-heading" className="text-xl sm:text-2xl font-bold">
          Продолжить просмотр
        </h2>
        <Link href="/watching" className="text-sm text-rose-400">
          Вся библиотека →
        </Link>
      </div>
      {error ? (
        <p role="alert">
          Не удалось загрузить продолжение просмотра.{" "}
          <button
            className="text-rose-400"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Повторить загрузку
          </button>
        </p>
      ) : !items ? (
        <p className="text-neutral-400">Загрузка вашего прогресса…</p>
      ) : null}
      {items && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.showId}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 flex gap-4"
            >
              {item.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.posterUrl}
                  alt=""
                  className="w-16 h-24 rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold break-words">{item.title}</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  {item.kind === "series" && item.next
                    ? `${item.next.season} сезон · ${item.next.episode} серия`
                    : item.kind === "movie"
                      ? "Фильм"
                      : "Ждём новые серии"}
                </p>
                {item.stoppedAt && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Остановились на {item.stoppedAt}
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {item.kind === "series"
                    ? `${item.watched} из ${item.total} серий`
                    : ""}
                </p>
                {item.kind === "series" && item.percent !== null && (
                  <div
                    role="progressbar"
                    aria-label={`Прогресс: ${item.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.percent}
                    className="h-1 rounded-full bg-neutral-800 mt-3"
                  >
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                )}
                <Link
                  href={`/library/${item.showId}`}
                  className="inline-flex mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold"
                >
                  Открыть трекер →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
