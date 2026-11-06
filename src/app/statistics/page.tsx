"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "@/components/AccountAccess";
type Stats = {
  minutes: number;
  movies: number;
  episodes: number;
  titles: number;
  estimated: number;
  undated: number;
  daily: { date: string; movies: number; episodes: number; minutes: number }[];
  genres: { name: string; count: number }[];
};
export default function StatisticsPage() {
  const { account, loading } = useAccount(),
    [days, setDays] = useState(30),
    [stats, setStats] = useState<Stats | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false),
    [attempt, setAttempt] = useState(0);
  const active = account?.premium.active;
  useEffect(() => {
    if (!active) return;
    const a = new AbortController();
    const t = setTimeout(() => {
      setFetching(true);
      setError("");
      fetch("/api/statistics?days=" + days, {
        signal: a.signal,
        cache: "no-store",
      })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error || "Не удалось загрузить статистику");
          return d;
        })
        .then((d) => {
          if (!a.signal.aborted) setStats(d);
        })
        .catch((e) => {
          if (!a.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!a.signal.aborted) setFetching(false);
        });
    }, 0);
    return () => {
      clearTimeout(t);
      a.abort();
    };
  }, [active, days, attempt]);
  if (loading) return <p role="status">Загрузка…</p>;
  if (!active)
    return (
      <div className="account-ui">
        <h1>Статистика просмотров</h1>
        <p>Расширенная статистика доступна с EpisyHub Premium.</p>
        <Link className="account-button primary" href="/premium">
          О Premium →
        </Link>
      </div>
    );
  const max = Math.max(1, ...(stats?.daily.map((d) => d.minutes) || []));
  return (
    <div className="account-ui">
      <h1>Статистика просмотров</h1>
      <p className="account-muted">
        Ваша личная статистика по отмеченным просмотрам. Даты сгруппированы по
        UTC.
      </p>
      <div className="account-tabs">
        {[30, 90, 365].map((n) => (
          <button
            key={n}
            className={days === n ? "active" : ""}
            onClick={() => {
              setStats(null);
              setDays(n);
            }}
          >
            {n} дней
          </button>
        ))}
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="account-button"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Повторить
          </button>
        </p>
      )}
      {fetching && <p role="status">Считаем просмотры…</p>}
      {stats && !fetching && (
        <>
          <div className="premium-benefits">
            {[
              [Math.round(stats.minutes / 60) + " ч", "Время просмотра"],
              [stats.movies, "Фильмов"],
              [stats.episodes, "Серий"],
              [stats.titles, "Уникальных тайтлов"],
            ].map(([v, label]) => (
              <section className="account-panel" key={label}>
                <strong className="stats-value">{v}</strong>
                <p>{label}</p>
              </section>
            ))}
          </div>
          <section className="account-panel">
            <h2>Динамика просмотров</h2>
            <p className="account-muted">
              Наведите на день, чтобы увидеть количество просмотров.
            </p>
            <div
              className="stats-chart"
              role="list"
              aria-label="Просмотры по дням"
            >
              {stats.daily.map((d) => (
                <div
                  role="listitem"
                  tabIndex={0}
                  key={d.date}
                  title={`${d.date}: ${d.movies} фильмов, ${d.episodes} серий, ${d.minutes} мин`}
                  aria-label={`${d.date}: ${d.movies} фильмов, ${d.episodes} серий, ${d.minutes} минут`}
                  style={{ height: `${Math.max(2, (d.minutes / max) * 100)}%` }}
                />
              ))}
            </div>
            <div className="account-line">
              <small>{stats.daily[0]?.date}</small>
              <small>{stats.daily.at(-1)?.date}</small>
            </div>
            {stats.minutes === 0 && (
              <p>За этот период пока нет отмеченных просмотров.</p>
            )}
          </section>
          <section className="account-panel">
            <h2>Любимые жанры периода</h2>
            <p className="account-muted">
              Количество просмотренных фильмов и серий по жанрам.
            </p>
            {stats.genres.length ? (
              stats.genres.map((g) => (
                <div className="stats-genre" key={g.name}>
                  <span>{g.name}</span>
                  <meter min={0} max={stats.genres[0].count} value={g.count} />
                  <strong>{g.count}</strong>
                </div>
              ))
            ) : (
              <p>Пока нет данных о жанрах.</p>
            )}
          </section>
          <p className="account-muted">
            {stats.estimated > 0
              ? `Для ${stats.estimated} просмотров длительность оценена: 110 минут для фильма и 45 минут для серии. `
              : ""}
            {stats.undated > 0
              ? `${stats.undated} отметок без даты не включены в отчёт по периоду.`
              : ""}{" "}
            Повторные просмотры одного эпизода не учитываются отдельно.
          </p>
        </>
      )}
    </div>
  );
}
