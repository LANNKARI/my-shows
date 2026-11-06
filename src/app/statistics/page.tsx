"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useAccount } from "@/components/AccountAccess";
import type { ActivityDay, ViewingStatistics } from "@/lib/viewing-statistics";
import styles from "./statistics.module.css";
const subscribeZone = (notify: () => void) => {
  window.addEventListener("focus", notify);
  return () => window.removeEventListener("focus", notify);
};
const number = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n);
const hours = (minutes: number) => number(minutes / 60) + " ч";
const time = (minutes: number | null) => {
  if (minutes === null) return "—";
  const n = Math.round(minutes);
  return n >= 60
    ? `${Math.floor(n / 60)} ч${n % 60 ? " " + (n % 60) + " мин" : ""}`
    : `${n} мин`;
};
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
const colors = [
  "var(--stat-cyan)",
  "var(--stat-gold)",
  "var(--stat-pink)",
  "var(--stat-purple)",
  "var(--stat-blue)",
  "var(--text-dim)",
];
const statusNames: Record<string, string> = {
  planned: "В планах",
  watching: "Смотрю",
  completed: "Просмотрено",
  dropped: "Брошено",
};
export default function StatisticsPage() {
  const { account, loading, error: accountError, refresh } = useAccount();
  const [days, setDays] = useState(30),
    [stats, setStats] = useState<ViewingStatistics | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false),
    [attempt, setAttempt] = useState(0),
    [granularity, setGranularity] = useState<"months" | "years">("months"),
    [activityScale, setActivityScale] = useState<"days" | "weeks">("weeks");
  const active = account?.premium.active;
  const zone = useSyncExternalStore(
    subscribeZone,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setFetching(true);
      setError("");
      setStats(null);
      fetch(
        `/api/statistics?days=${days}&timeZone=${encodeURIComponent(zone)}`,
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok)
            throw new Error(d.error || "Не удалось загрузить статистику");
          return d;
        })
        .then((d) => {
          if (!controller.signal.aborted) setStats(d);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setFetching(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, days, zone, attempt]);
  if (loading) return <p role="status">Загрузка статистики…</p>;
  if (accountError)
    return (
      <section className="account-ui">
        <h1>Статистика просмотров</h1>
        <p role="alert">{accountError}</p>
        <button className="account-button" onClick={() => void refresh()}>
          Повторить
        </button>
      </section>
    );
  if (!active)
    return (
      <section className="account-ui">
        <h1>Статистика просмотров</h1>
        <p>Расширенная статистика доступна с EpisyHub Premium.</p>
        <Link href="/premium" className="account-button primary">
          О Premium →
        </Link>
      </section>
    );
  const totals = stats?.totals;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ВАША ИСТОРИЯ В МИРЕ КИНО</p>
          <h1>Ваша статистика просмотров</h1>
          <p className={styles.subtitle}>
            Фильмы, истории и время, которое вы провели вместе.
          </p>
          <span className={styles.premium}>✦ EpisyHub Premium</span>
        </div>
        {stats && (
          <aside
            className={styles.percentile}
            aria-label="Сравнение с другими пользователями"
          >
            <strong>
              {stats.percentile.value !== null
                ? `Больше, чем ${stats.percentile.value}%`
                : "Начало вашей истории"}
            </strong>
            <p>
              {stats.percentile.value !== null
                ? `Пользователей для сравнения: ${number(stats.percentile.participants)}. Только те, у кого есть просмотры.`
                : "Для сравнения нужны ваши просмотры и хотя бы один другой зритель."}
            </p>
            <small>
              Один фильм или одна серия — один просмотр. Равные результаты не
              считаются меньшими.
            </small>
          </aside>
        )}
      </header>
      {error && (
        <p role="alert" className={styles.notice}>
          {error}{" "}
          <button onClick={() => setAttempt((v) => v + 1)}>Повторить</button>
        </p>
      )}
      {(fetching || (!stats && !error)) && (
        <div className={styles.loading} role="status">
          Собираем вашу киноисторию…
        </div>
      )}
      {stats && totals && (
        <>
          <div className={styles.sectionTitle}>
            <h2>Вся ваша библиотека</h2>
            <p>За всё время · включая импорт и массовые отметки</p>
          </div>
          <div className={styles.dashboard}>
            <section className={`${styles.card} ${styles.summary}`}>
              <h2>Общее время</h2>
              <div className={styles.timeBody}>
                <div>
                  <strong className={styles.totalHours}>
                    {number(totals.minutes / 60)}
                  </strong>
                  <span className={styles.caption}>часов просмотра</span>
                  <p>
                    <i style={{ background: colors[0] }} />
                    Фильмы <b>{hours(totals.movieMinutes)}</b>
                  </p>
                  <p>
                    <i style={{ background: colors[3] }} />
                    Сериалы <b>{hours(totals.seriesMinutes)}</b>
                  </p>
                </div>
                <svg
                  className={styles.rings}
                  viewBox="0 0 140 140"
                  role="img"
                  aria-label={`Фильмы: ${hours(totals.movieMinutes)}, сериалы: ${hours(totals.seriesMinutes)}`}
                >
                  <circle cx="70" cy="70" r="57" className={styles.ringTrack} />
                  <circle
                    cx="70"
                    cy="70"
                    r="57"
                    pathLength="100"
                    stroke="var(--stat-cyan)"
                    strokeDasharray={`${totals.minutes ? (totals.movieMinutes / totals.minutes) * 100 : 0} 100`}
                    transform="rotate(-90 70 70)"
                  />
                  <circle cx="70" cy="70" r="40" className={styles.ringTrack} />
                  <circle
                    cx="70"
                    cy="70"
                    r="40"
                    pathLength="100"
                    stroke="var(--stat-purple)"
                    strokeDasharray={`${totals.minutes ? (totals.seriesMinutes / totals.minutes) * 100 : 0} 100`}
                    transform="rotate(-90 70 70)"
                  />
                </svg>
              </div>
              <p className={styles.hint}>
                Сумма длительностей отмеченных просмотров
              </p>
            </section>
            <section className={`${styles.card} ${styles.trend}`}>
              <div className={styles.cardTitle}>
                <h2>Динамика просмотров</h2>
                <label className={styles.selectLabel}>
                  <span className={styles.srOnly}>Группировка динамики</span>
                  <select
                    value={granularity}
                    onChange={(e) =>
                      setGranularity(e.target.value as "months" | "years")
                    }
                  >
                    <option value="months">Месяцы</option>
                    <option value="years">Годы</option>
                  </select>
                </label>
              </div>
              <Trend
                rows={granularity === "months" ? stats.monthly : stats.yearly}
                monthly={granularity === "months"}
              />
              <p className={styles.hint}>
                По датам ручных отметок · массовые отметки включены
              </p>
            </section>
            <div className={styles.counters}>
              {[
                [totals.movies, "Фильмов", "Просмотрено"],
                [
                  totals.series,
                  "Сериалов",
                  `${totals.series} начато · ${totals.completedSeries} завершено`,
                ],
                [totals.episodes, "Серий", "Отмечено просмотренными"],
                [
                  totals.seasons,
                  "Сезонов",
                  `${totals.seasons} начато · ${totals.completedSeasons} завершено`,
                ],
              ].map(([value, label, hint]) => (
                <section
                  className={`${styles.card} ${styles.counter}`}
                  key={label}
                >
                  <span>{label}</span>
                  <strong>{number(Number(value))}</strong>
                  <small>{hint}</small>
                </section>
              ))}
            </div>
            <section className={`${styles.card} ${styles.genres}`}>
              <h2>Любимые жанры</h2>
              <p className={styles.hint}>
                По уникальным фильмам и сериалам с просмотрами
              </p>
              <Genres
                genres={stats.genres}
                titles={totals.movies + totals.series}
              />
              <p className={styles.hint}>
                Тайтл учитывается один раз в каждом своём жанре. Доля сектора —
                среди всех жанровых вхождений.
              </p>
            </section>
          </div>
          <div className={styles.grid}>
            <section className={styles.card}>
              <h2>Фильмы и сериалы</h2>
              <Ratio
                title="По количеству тайтлов"
                a={totals.movies}
                b={totals.series}
                format={number}
              />
              <Ratio
                title="По времени просмотра"
                a={totals.movieMinutes}
                b={totals.seriesMinutes}
                format={hours}
              />
            </section>
            <section className={styles.card}>
              <h2>География и годы выпуска</h2>
              <Bars rows={stats.countries} label="Страны производства" />
              <p className={styles.hint}>
                Совместное производство учитывается в каждой стране.
              </p>
              <h3>Годы выпуска</h3>
              <ReleaseYears rows={stats.years} />
            </section>
            <section className={styles.card}>
              <div className={styles.cardTitle}>
                <h2>Личные оценки</h2>
                <strong className={styles.average}>
                  {stats.ratings.average === null
                    ? "—"
                    : number(stats.ratings.average)}{" "}
                  <small>/ 10</small>
                </strong>
              </div>
              <p className={styles.hint}>
                Средняя оценка · {number(stats.ratings.count)} оценённых тайтлов
              </p>
              <div
                className={styles.ratings}
                role="list"
                aria-label="Распределение личных оценок"
              >
                {stats.ratings.distribution.map((r) => (
                  <div
                    role="listitem"
                    key={r.score}
                    tabIndex={0}
                    title={`${r.score}/10: ${r.count}`}
                    aria-label={`Оценка ${r.score}: ${r.count} тайтлов`}
                  >
                    <b>{r.count || ""}</b>
                    <i
                      style={{
                        height: `${r.count ? Math.max(3, (r.count / Math.max(1, ...stats.ratings.distribution.map((v) => v.count))) * 90) : 0}px`,
                      }}
                    />
                    <span>{r.score}</span>
                  </div>
                ))}
              </div>
              {!stats.ratings.count && (
                <p className={styles.hint}>
                  Оцените фильм или сериал, чтобы увидеть распределение.
                </p>
              )}
            </section>
            <section className={styles.card}>
              <h2>Путь тайтлов в библиотеке</h2>
              <p className={styles.hint}>
                Текущие статусы всех фильмов и сериалов
              </p>
              <Bars
                rows={Object.entries(statusNames).map(([key, name]) => ({
                  name,
                  count: stats.statuses[key] || 0,
                }))}
                label="Статусы библиотеки"
              />
            </section>
          </div>
          <div className={styles.sectionTitle}>
            <div>
              <h2>Ваш ритм просмотра</h2>
              <p>Активность за выбранный период · {stats.timeZone}</p>
            </div>
            <div
              className={styles.tabs}
              role="group"
              aria-label="Период статистики"
            >
              {[30, 90, 365].map((n) => (
                <button
                  key={n}
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                >
                  {n} дней
                </button>
              ))}
            </div>
          </div>
          <div className={styles.metrics}>
            {[
              [
                time(stats.activity.averageDay),
                "В среднем в день",
                "С учётом дней без просмотра",
              ],
              [
                time(stats.activity.averageWeek),
                "В среднем за неделю",
                "Дневное среднее × 7",
              ],
              [
                `${stats.activity.currentStreak} дн.`,
                "Текущий стрик",
                `Лучший — ${stats.activity.longestStreak} дн. за всё время`,
              ],
              [
                stats.activity.favoriteDay
                  ? `${stats.activity.favoriteDay} · ${stats.activity.favoritePart?.toLowerCase()}`
                  : "Пока нет данных",
                "Ваше любимое время",
                "По объёму ручных отметок",
              ],
            ].map(([value, label, hint]) => (
              <section className={styles.card} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </section>
            ))}
          </div>
          <Heatmap days={stats.heatmap} />
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h2>Активность за выбранный период</h2>
              <div
                className={styles.tabs}
                role="group"
                aria-label="Группировка активности"
              >
                {(["days", "weeks"] as const).map((scale) => (
                  <button
                    key={scale}
                    aria-pressed={activityScale === scale}
                    onClick={() => setActivityScale(scale)}
                  >
                    {scale === "days" ? "Дни" : "Недели"}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.hint}>
              {dateLabel(stats.from)} — {dateLabel(stats.today)} ·{" "}
              {hours(stats.activity.minutes)} в отметках
            </p>
            <ActivityChart days={stats.daily} scale={activityScale} />
            <div className={styles.notice}>
              Дней с объёмом свыше 15 часов: <b>{stats.activity.bulkDays}</b>.
              Они остаются в общих итогах, графиках, heatmap и стрике, но
              исключены из средних и любимого времени. В расчёте средних:{" "}
              {stats.activity.eligibleDays} дней из {days}.
            </div>
            <p className={styles.hint}>
              Импорт не создаёт активность. Время суток определяется по моменту
              отметки, а не по фактическому воспроизведению: ночь 00–06, утро
              06–12, день 12–18, вечер 18–24.
            </p>
          </section>
          <footer className={styles.footer}>
            <p>
              Новый учёт активности — по ручным отметкам.{" "}
              {stats.activity.firstDate
                ? `Первая отметка: ${dateLabel(stats.activity.firstDate)}.`
                : "Новые просмотры появятся здесь после первой ручной отметки."}{" "}
              Старые и импортированные просмотры остаются в общих итогах.
            </p>
            <p>
              Импортировано: {number(totals.imported)} · Старых отметок с
              неизвестным источником: {number(totals.legacy)} · Без даты:{" "}
              {number(totals.undated)}. Категории могут пересекаться.
            </p>
            {totals.estimated > 0 && (
              <p>
                Для {number(totals.estimated)} просмотров длительность
                приблизительная: 110 минут на фильм и 45 на серию, если в TMDB
                нет данных.
              </p>
            )}
            <p>
              Сезон считается начатым после первой просмотренной серии,
              завершённым — когда отмечены все известные серии сезона.
              Спецвыпуски вне сезонов входят только в счётчик серий. Повторные
              отметки одного просмотра не увеличивают итог.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
function Bars({
  rows,
  label,
}: {
  rows: { name: string; count: number }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.length ? (
    <div className={styles.bars} role="list" aria-label={label}>
      {rows.map((r) => (
        <div key={r.name} className={styles.bar} role="listitem">
          <span>{r.name}</span>
          <meter min={0} max={max} value={r.count} aria-label={r.name} />
          <b>{number(r.count)}</b>
        </div>
      ))}
    </div>
  ) : (
    <p className={styles.hint}>Пока нет данных.</p>
  );
}
function ReleaseYears({ rows }: { rows: { name: string; count: number }[] }) {
  const buckets = [
    { name: "До 2000", count: 0 },
    { name: "2000–2009", count: 0 },
    { name: "2010–2019", count: 0 },
    { name: "2020+", count: 0 },
  ];
  for (const row of rows) {
    const year = Number(row.name);
    if (Number.isFinite(year))
      buckets[year < 2000 ? 0 : year < 2010 ? 1 : year < 2020 ? 2 : 3].count +=
        row.count;
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return rows.length ? (
    <>
      <div
        className={styles.releaseYears}
        role="list"
        aria-label="Годы выпуска"
      >
        {buckets.map((b) => (
          <div
            role="listitem"
            key={b.name}
            aria-label={`${b.name}: ${b.count} тайтлов`}
          >
            <b>{number(b.count)}</b>
            <i style={{ height: `${Math.max(1, (b.count / max) * 70)}px` }} />
            <span>{b.name}</span>
          </div>
        ))}
      </div>
      <details className={styles.details}>
        <summary>Все годы выпуска</summary>
        <div className={styles.years}>
          {rows.map((r) => (
            <div key={r.name}>
              <span>{r.name}</span>
              <b>{number(r.count)}</b>
            </div>
          ))}
        </div>
      </details>
    </>
  ) : (
    <p className={styles.hint}>Пока нет данных о годах выпуска.</p>
  );
}
function Ratio({
  title,
  a,
  b,
  format,
}: {
  title: string;
  a: number;
  b: number;
  format: (n: number) => string;
}) {
  return (
    <div className={styles.ratio}>
      <h3>{title}</h3>
      <div
        className={styles.split}
        role="img"
        aria-label={`Фильмы: ${format(a)}, сериалы: ${format(b)}`}
      >
        <span style={{ width: `${a + b ? (a / (a + b)) * 100 : 0}%` }} />
        <i style={{ width: `${a + b ? (b / (a + b)) * 100 : 0}%` }} />
      </div>
      <div className={styles.legend}>
        <span>Фильмы · {format(a)}</span>
        <span>Сериалы · {format(b)}</span>
      </div>
    </div>
  );
}
function Genres({
  genres,
  titles,
}: {
  genres: { name: string; count: number }[];
  titles: number;
}) {
  const total = genres.reduce((s, g) => s + g.count, 0);
  const rows = genres.slice(0, 5);
  if (genres.length > 5)
    rows.push({
      name: "Другие",
      count: genres.slice(5).reduce((s, g) => s + g.count, 0),
    });
  const gradient = rows
    .map((r, i) => {
      const from =
        (rows.slice(0, i).reduce((sum, row) => sum + row.count, 0) /
          Math.max(1, total)) *
        100;
      const to = from + (r.count / Math.max(1, total)) * 100;
      return `${colors[i]} ${from}% ${to}%`;
    })
    .join(",");
  return total ? (
    <>
      <div className={styles.genreBody}>
        <div
          className={styles.donut}
          role="img"
          aria-label={`${titles} тайтлов с просмотрами. Распределение по жанрам`}
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div>
            <strong>{number(titles)}</strong>
            <small>тайтлов</small>
          </div>
        </div>
        <ul className={styles.genreLegend}>
          {rows.map((r, i) => (
            <li key={r.name}>
              <span>
                <i style={{ background: colors[i] }} />
                {r.name}
              </span>
              <b>
                {number(r.count)}{" "}
                <small>· {number((r.count / total) * 100)}%</small>
              </b>
            </li>
          ))}
        </ul>
      </div>
      {genres.length > 5 && (
        <details className={styles.details}>
          <summary>Все жанры</summary>
          <Bars rows={genres} label="Все жанры" />
        </details>
      )}
    </>
  ) : (
    <p className={styles.empty}>
      Отметьте первый просмотр — здесь появятся ваши жанры.
    </p>
  );
}
function Trend({
  rows,
  monthly,
}: {
  rows: { name: string; minutes: number }[];
  monthly: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const points = rows.map((r, i) => ({
    x: rows.length === 1 ? 210 : 10 + (i / Math.max(1, rows.length - 1)) * 400,
    y: 145 - (r.minutes / max) * 125,
  }));
  let line = "";
  points.forEach((p, i) => {
    if (!i) line = `M${p.x},${p.y}`;
    else {
      const prev = points[i - 1],
        mid = (prev.x + p.x) / 2;
      line += ` C${mid},${prev.y} ${mid},${p.y} ${p.x},${p.y}`;
    }
  });
  const current = selected !== null ? rows[selected] : null;
  return (
    <>
      <div className={styles.trendPlot}>
        <svg
          viewBox="0 0 420 165"
          role="img"
          aria-label="Динамика часов просмотра"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="stats-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--stat-cyan)" stopOpacity=".25" />
              <stop offset="1" stopColor="var(--stat-purple)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.length > 0 && (
            <>
              <path
                style={rows.length === 1 ? { display: "none" } : undefined}
                d={`${line} L${points.at(-1)!.x},160 L${points[0].x},160Z`}
                fill="url(#stats-trend-fill)"
              />
              <path
                d={line}
                style={rows.length === 1 ? { display: "none" } : undefined}
                fill="none"
                stroke="var(--stat-cyan)"
                strokeWidth="3"
              />
              {rows.length === 1 && (
                <rect
                  x="155"
                  y={points[0].y}
                  width="110"
                  height={160 - points[0].y}
                  rx="8"
                  fill="var(--stat-cyan)"
                  opacity=".8"
                />
              )}
              {rows.length > 1 &&
                points.map((p, i) => (
                  <circle
                    key={rows[i].name}
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="var(--bg-2)"
                    stroke="var(--stat-cyan)"
                    strokeWidth="2"
                  />
                ))}
            </>
          )}
        </svg>
        <div className={styles.trendLabels}>
          {rows.map((r, i) => (
            <button
              key={r.name}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              onClick={() => setSelected(i)}
              aria-label={`${r.name}: ${hours(r.minutes)}`}
            >
              {monthly
                ? [
                    "янв",
                    "фев",
                    "мар",
                    "апр",
                    "май",
                    "июн",
                    "июл",
                    "авг",
                    "сен",
                    "окт",
                    "ноя",
                    "дек",
                  ][Number(r.name.slice(5)) - 1]
                : r.name}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.chartValue} aria-live="polite">
        {current
          ? `${current.name}: ${hours(current.minutes)}`
          : rows.some((r) => r.minutes)
            ? "Выберите месяц или год для подробностей"
            : "Пока нет ручных отметок за этот период."}
      </p>
    </>
  );
}
function Heatmap({ days }: { days: ActivityDay[] }) {
  const [selected, setSelected] = useState<ActivityDay | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const e = ref.current;
    if (e) e.scrollLeft = e.scrollWidth;
  }, [days]);
  const pad = (new Date(days[0].date + "T12:00:00Z").getUTCDay() + 6) % 7;
  return (
    <section className={`${styles.card} ${styles.heatCard}`}>
      <div className={styles.cardTitle}>
        <h2>Календарь активности</h2>
        <small>
          {days.filter((d) => d.count > 0).length} активных дней за год
        </small>
      </div>
      <p className={styles.hint}>
        Количество фильмов и серий · последние 365 дней · массовые отметки
        сохраняются
      </p>
      <div className={styles.heatLayout}>
        <div className={styles.weekdayLabels} aria-hidden="true">
          {["Пн", "", "Ср", "", "Пт", "", "Вс"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.heatScroll} ref={ref}>
          <div className={styles.heatInner}>
            <div className={styles.heatMonths} aria-hidden="true">
              {days.map((d, i) =>
                d.date.endsWith("-01") ? (
                  <span
                    key={d.date}
                    style={{
                      left: `calc(${Math.floor((pad + i) / 7)} * var(--heat-step))`,
                    }}
                  >
                    {
                      [
                        "янв",
                        "фев",
                        "мар",
                        "апр",
                        "май",
                        "июн",
                        "июл",
                        "авг",
                        "сен",
                        "окт",
                        "ноя",
                        "дек",
                      ][Number(d.date.slice(5, 7)) - 1]
                    }
                  </span>
                ) : null,
              )}
            </div>
            <div className={styles.heat}>
              {Array.from({ length: pad }, (_, i) => (
                <span key={"pad" + i} />
              ))}
              {days.map((d) => (
                <button
                  key={d.date}
                  data-level={
                    d.count === 0
                      ? 0
                      : d.count <= 2
                        ? 1
                        : d.count <= 5
                          ? 2
                          : d.count <= 10
                            ? 3
                            : 4
                  }
                  data-bulk={d.bulk}
                  aria-label={`${dateLabel(d.date)}: ${d.movies} фильмов, ${d.episodes} серий, ${time(d.minutes)}${d.bulk ? ", массовые отметки" : ""}`}
                  title={`${dateLabel(d.date)}: ${d.count} просмотров${d.bulk ? " · массовые отметки" : ""}`}
                  onFocus={() => setSelected(d)}
                  onMouseEnter={() => setSelected(d)}
                  onClick={() => setSelected(d)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.legend}>
        <span>
          Меньше <i className={styles.heatKey} /> Больше
        </span>
        <span>Золотая рамка — свыше 15 ч</span>
      </div>
      <p className={styles.chartValue} aria-live="polite">
        {selected
          ? `${dateLabel(selected.date)}: ${selected.movies} фильмов, ${selected.episodes} серий · ${time(selected.minutes)}${selected.bulk ? " · массовые отметки" : ""}`
          : "Выберите день, чтобы увидеть подробности."}
      </p>
    </section>
  );
}
function ActivityChart({
  days,
  scale,
}: {
  days: ActivityDay[];
  scale: "days" | "weeks";
}) {
  const rows =
    scale === "days"
      ? days.map((d) => ({
          label: dateLabel(d.date),
          minutes: d.minutes,
          bulk: d.bulk ? d.minutes : 0,
        }))
      : Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => {
          const group = days.slice(i * 7, i * 7 + 7);
          return {
            label: `${dateLabel(group[0].date)} — ${dateLabel(group.at(-1)!.date)}`,
            minutes: group.reduce((s, d) => s + d.minutes, 0),
            bulk: group
              .filter((d) => d.bulk)
              .reduce((s, d) => s + d.minutes, 0),
          };
        });
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const [selected, setSelected] = useState<string>("");
  return (
    <>
      <div className={styles.activityScroll}>
        <div
          className={styles.activityChart}
          style={{ "--bar-count": rows.length } as CSSProperties}
        >
          {rows.map((r) => (
            <button
              key={r.label}
              aria-label={`${r.label}: ${hours(r.minutes)}${r.bulk ? ", включая массовые отметки" : ""}`}
              title={`${r.label}: ${hours(r.minutes)}`}
              onFocus={() =>
                setSelected(
                  `${r.label}: ${hours(r.minutes)} · массовые отметки ${hours(r.bulk)}`,
                )
              }
              onMouseEnter={() =>
                setSelected(
                  `${r.label}: ${hours(r.minutes)} · массовые отметки ${hours(r.bulk)}`,
                )
              }
              onClick={() =>
                setSelected(
                  `${r.label}: ${hours(r.minutes)} · массовые отметки ${hours(r.bulk)}`,
                )
              }
            >
              <span
                className={styles.activityBar}
                style={{ height: `${Math.max(2, (r.minutes / max) * 110)}px` }}
              >
                <i
                  style={{
                    height: `${r.minutes ? (r.bulk / r.minutes) * 100 : 0}%`,
                  }}
                />
              </span>
              <small>{r.label.split(" ").slice(0, 2).join(" ")}</small>
            </button>
          ))}
        </div>
      </div>
      <p className={styles.chartValue} aria-live="polite">
        {selected || "Выберите столбец, чтобы увидеть часы и массовые отметки."}
      </p>
    </>
  );
}
