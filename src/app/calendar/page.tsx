/* eslint-disable @next/next/no-img-element -- Existing catalogue posters use remote URLs and a plain image fallback. */
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  calendarRange,
  formatDay,
  rangeDays,
  shiftMonth,
  todayInZone,
  validDay,
} from "@/lib/calendar-dates";
import type { CalendarData, ReleaseEvent } from "@/lib/release-types";
import ReleaseFollowButton from "@/components/ReleaseFollowButton";
import "@/components/releases.css";
export default function CalendarPage() {
  const { data: session, status } = useSession();
  if (status === "loading") return <p role="status">Загрузка календаря…</p>;
  return session?.user?.id ? (
    <Calendar key={session.user.id} />
  ) : (
    <div className="release-ui rc-panel">
      <h1>Календарь серий</h1>
      <p className="rc-muted my-4">
        Войдите, чтобы увидеть продолжения сериалов из своей библиотеки.
      </p>
      <Link href="/login" className="rc-button rc-primary">
        Войти
      </Link>
    </div>
  );
}
function Calendar() {
  const params = useSearchParams();
  const [today] = useState(() =>
    todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const rawDay = params.get("date");
  const anchor =
    validDay(rawDay) && rawDay >= "2000-01-01" && rawDay <= "2100-12-31"
      ? rawDay
      : today;
  const view = params.get("view") === "month" ? "month" : "week";
  const filter = ["watching", "planned", "completed", "all"].includes(
    params.get("status") || "",
  )
    ? params.get("status")!
    : "watching";
  const [data, setData] = useState<CalendarData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [syncing, setSyncing] = useState(false),
    [syncMessage, setSyncMessage] = useState("");
  const [reload, setReload] = useState(0);
  const controller = useRef<AbortController | null>(null),
    syncLock = useRef(false),
    attempted = useRef(new Set<string>());
  const { from, to } = calendarRange(anchor, view),
    key = `${from}:${to}:${filter}`;
  const [loadedKey, setLoadedKey] = useState("");
  const activeRange = useRef(key);
  useEffect(() => {
    activeRange.current = key;
  }, [key]);
  function navigate(next: { date?: string; view?: string; status?: string }) {
    const query = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([name, value]) => {
      if (value) query.set(name, value);
    });
    setSyncMessage("");
    window.history.pushState(null, "", `/calendar?${query}`);
  }
  async function sync(snapshot: CalendarData, automatic = false) {
    if (syncLock.current) return;
    const ids = snapshot.syncIds.filter(
      (id) => !automatic || !attempted.current.has(`${key}:${id}`),
    );
    if (!ids.length) return;
    syncLock.current = true;
    setSyncing(true);
    setSyncMessage("Обновляем расписание…");
    let failures = 0;
    let done = 0;
    try {
      for (let offset = 0; offset < Math.min(ids.length, 10); offset += 2) {
        if (activeRange.current !== key) break;
        const batch = ids.slice(offset, offset + 2);
        batch.forEach((id) => attempted.current.add(`${key}:${id}`));
        const response = await fetch(
          `/api/calendar/sync?from=${from}&to=${to}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ showIds: batch }),
            signal: AbortSignal.timeout(30000),
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Не удалось обновить расписание");
        failures += result.results.filter(
          (value: { ok: boolean }) => !value.ok,
        ).length;
        done += batch.length;
        if (activeRange.current === key)
          setSyncMessage(
            `Обновляем расписание: ${done} из ${ids.length} сериалов`,
          );
      }
      if (activeRange.current === key)
        setSyncMessage(
          failures
            ? "Часть расписания недоступна. Сохранённые даты показаны; повторите обновление через минуту."
            : ids.length > 10
              ? "Часть сериалов обновлена. Нажмите «Обновить даты», чтобы продолжить."
              : "Расписание обновлено. Даты могут измениться.",
        );
    } catch (error) {
      if (activeRange.current === key)
        setSyncMessage(
          error instanceof Error && error.name === "Error"
            ? error.message
            : "Не удалось обновить расписание. Сохранённые даты показаны.",
        );
    } finally {
      syncLock.current = false;
      setSyncing(false);
      setReload((value) => value + 1);
      window.dispatchEvent(new Event("notifications-updated"));
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    void (async () => {
      await Promise.resolve();
      if (abort.signal.aborted) return;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/calendar?from=${from}&to=${to}&status=${filter}`,
          { signal: abort.signal, cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Не удалось загрузить календарь");
        if (!abort.signal.aborted) {
          setLoadedKey(key);
          setData(result);
        }
      } catch (error) {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error && error.name === "Error"
              ? error.message
              : "Не удалось загрузить календарь.",
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [from, to, filter, key, reload]);
  useEffect(() => {
    if (
      [...attempted.current].filter((value) => value.startsWith(`${key}:`))
        .length >= 10
    )
      return;
    if (
      !data ||
      loadedKey !== key ||
      !data.syncIds.some((id) => !attempted.current.has(`${key}:${id}`))
    )
      return;
    // Refresh one bounded chunk automatically; larger libraries can continue explicitly.
    const timer = setTimeout(() => {
      void sync(data, true);
    }, 0);
    return () => clearTimeout(timer);
    // sync captures this exact range; the effect is intentionally tied to its loaded snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);
  const currentData = loadedKey === key ? data : null;
  const days = rangeDays(from, to),
    chosenDay = anchor;
  const events = currentData?.events || [];
  const shown =
    view === "month"
      ? events.filter((event) => event.date === chosenDay)
      : events;
  const groups = [...new Set(shown.map((event) => event.date))];
  return (
    <div className="release-ui rc-calendar">
      <div className="rc-heading">
        <div>
          <h1>Календарь серий</h1>
          <p className="rc-muted">Продолжения сериалов из вашей библиотеки</p>
        </div>
        <Link href="/notifications" className="rc-link rc-calendar-inbox">
          Уведомления →
        </Link>
      </div>
      <div className="rc-toolbar">
        <div className="rc-tabs" aria-label="Вид календаря">
          <button
            aria-pressed={view === "week"}
            onClick={() => navigate({ view: "week" })}
          >
            Неделя
          </button>
          <button
            aria-pressed={view === "month"}
            onClick={() => navigate({ view: "month" })}
          >
            Месяц
          </button>
        </div>
        <div className="rc-period">
          <button
            className="rc-button"
            aria-label="Предыдущий период"
            disabled={anchor < "2000-02-01"}
            onClick={() =>
              navigate({
                date:
                  view === "month"
                    ? shiftMonth(anchor, -1)
                    : addDays(anchor, -7),
              })
            }
          >
            ‹
          </button>
          <strong>
            {view === "month"
              ? formatDay(anchor, { month: "long", year: "numeric" })
              : `${formatDay(from, { day: "numeric", month: "short" })} — ${formatDay(to, { day: "numeric", month: "short" })}`}
          </strong>
          <button
            className="rc-button"
            aria-label="Следующий период"
            disabled={anchor > "2100-11-01"}
            onClick={() =>
              navigate({
                date:
                  view === "month" ? shiftMonth(anchor, 1) : addDays(anchor, 7),
              })
            }
          >
            ›
          </button>
          <button
            className="rc-button"
            onClick={() => navigate({ date: today })}
          >
            Сегодня
          </button>
        </div>
      </div>
      <div className="rc-filters" aria-label="Статусы сериалов">
        {[
          ["watching", "Смотрю"],
          ["planned", "В планах"],
          ["completed", "Завершённые"],
          ["all", "Все"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => navigate({ status: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={`rc-date-grid ${view === "month" ? "is-month" : ""}`}
        aria-label={view === "month" ? "Дни месяца" : "Дни недели"}
      >
        {view === "month" &&
          ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span className="rc-weekday" key={day}>
              {day}
            </span>
          ))}
        {days.map((day) => {
          const count = events.filter((event) => event.date === day).length;
          return (
            <button
              key={day}
              className={`${day === today ? "is-today" : ""} ${day.slice(0, 7) !== anchor.slice(0, 7) ? "is-outside" : ""}`}
              aria-pressed={chosenDay === day}
              aria-label={`${formatDay(day, { weekday: "long", day: "numeric", month: "long" })}, серий: ${count}`}
              onClick={() => {
                navigate({ date: day });
                if (view === "week")
                  document
                    .getElementById(`day-${day}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              {view === "week" && (
                <span>{formatDay(day, { weekday: "short" })}</span>
              )}
              <strong>{formatDay(day, { day: "numeric" })}</strong>
              {count > 0 && (
                <span className="rc-day-count">
                  <i aria-hidden="true" />
                  {view === "month" ? (
                    count
                  ) : (
                    <span className="sr-only">{count} серий</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <div role="alert" className="rc-error">
          {error}
          <button
            className="rc-text"
            onClick={() => setReload((value) => value + 1)}
          >
            Повторить загрузку
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="rc-muted mt-4">
          Загрузка расписания…
        </p>
      )}
      {currentData && (
        <>
          <div className="rc-sync">
            <p role="status" className="rc-muted">
              {syncMessage ||
                (currentData.series.some((series) => !series.syncedAt)
                  ? "Расписание части сериалов ещё не обновлено."
                  : "Даты оригинального релиза. Перевод может появиться позже.")}
            </p>
            <button
              className="rc-text"
              disabled={syncing}
              onClick={() => {
                attempted.current.clear();
                if (currentData.syncIds.length) void sync(currentData);
                else setReload((value) => value + 1);
              }}
            >
              Обновить даты
            </button>
          </div>
          {!shown.length && !loading && (
            <section className="rc-panel rc-empty">
              <h2>
                {!currentData.series.length
                  ? "Здесь появятся ваши сериалы"
                  : "На эти даты серии пока не запланированы"}
              </h2>
              <p className="rc-muted">
                {!currentData.series.length
                  ? "Добавьте сериал в библиотеку или выберите другой статус."
                  : "У некоторых серий дата ещё неизвестна. Проверяйте расписание ближе к релизу."}
              </p>
              <Link className="rc-link" href="/watching">
                Открыть библиотеку →
              </Link>
            </section>
          )}
          <div className="rc-agenda">
            {groups.map((day) => (
              <section key={day} className="rc-panel" id={`day-${day}`}>
                <h2>
                  {day === today
                    ? "Сегодня · "
                    : day === addDays(today, 1)
                      ? "Завтра · "
                      : ""}
                  {formatDay(day)}
                </h2>
                {shown
                  .filter((event) => event.date === day)
                  .map((event) => (
                    <EventRow key={event.id} event={event} today={today} />
                  ))}
              </section>
            ))}
          </div>
          {currentData.truncated && (
            <p className="rc-muted mt-4">
              Показана первая тысяча серий. Выберите неделю или отдельный статус
              для более точного списка.
            </p>
          )}
          <section className="rc-panel rc-subscriptions">
            <h2>Уведомления по сериалам</h2>
            <p className="rc-muted">
              Подпишитесь на продолжения, даже если ближайшая дата пока
              неизвестна.
            </p>
            {currentData.series.map((series) => (
              <div className="rc-subscription" key={series.userShowId}>
                <Link href={`/library/${series.showId}`}>{series.title}</Link>
                <ReleaseFollowButton
                  key={`${series.userShowId}:${series.notifyReleases}`}
                  userShowId={series.userShowId}
                  enabled={series.notifyReleases}
                  title={series.title}
                  compact
                />
              </div>
            ))}
          </section>
        </>
      )}
      <p className="rc-muted mt-6">
        Указаны даты оригинального выхода, без точного времени и гарантии
        доступности перевода.
      </p>
    </div>
  );
}
function EventRow({ event, today }: { event: ReleaseEvent; today: string }) {
  return (
    <article
      className="rc-event"
      aria-label={`${event.title}: сезон ${event.season}, серия ${event.episode}`}
    >
      {event.posterUrl ? (
        <img className="rc-poster" src={event.posterUrl} alt="" />
      ) : (
        <div className="rc-poster rc-no-poster" aria-hidden="true">
          TV
        </div>
      )}
      <div className="rc-event-info">
        <h3>{event.title}</h3>
        <p>
          Сезон {event.season} · Серия {event.episode}
        </p>
        <span
          className={`rc-release-tag ${event.date < today ? "is-released" : ""}`}
        >
          {event.date === today
            ? "Выход сегодня"
            : event.date < today
              ? "Дата выхода прошла"
              : "Ожидается"}
          {event.watched ? " · Просмотрено" : ""}
        </span>
      </div>
      <div className="rc-event-actions">
        <ReleaseFollowButton
          key={`${event.userShowId}:${event.notifyReleases}`}
          userShowId={event.userShowId}
          enabled={event.notifyReleases}
          title={event.title}
        />
        <Link className="rc-link" href={`/library/${event.showId}`}>
          Открыть трекер →
        </Link>
      </div>
    </article>
  );
}
