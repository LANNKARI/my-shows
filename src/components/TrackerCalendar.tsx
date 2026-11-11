"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  addDays,
  formatDay,
  todayInZone,
  validDay,
} from "@/lib/calendar-dates";

type CalendarSeason = {
  seasonNumber: number;
  episodes: {
    id: number;
    season: number;
    episode: number;
    airDate?: string | null;
    name?: string | null;
  }[];
};
export default function TrackerCalendar({
  showId,
  seasons,
}: {
  showId: number;
  seasons: CalendarSeason[];
}) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<CalendarSeason[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const loadedSeasons = useRef(new Set<number>());
  const contentId = useId();
  useEffect(() => () => abort.current?.abort(), []);
  const today = todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const available = (schedule || seasons)
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const upcoming = available
    .flatMap((season) => season.episodes)
    .filter((episode) => validDay(episode.airDate) && episode.airDate >= today)
    .sort((a, b) => a.airDate!.localeCompare(b.airDate!))[0];
  const active =
    available.find((season) => season.seasonNumber === selected) ||
    available.find((season) => season.seasonNumber === upcoming?.season) ||
    available.at(-1);
  async function load(seasonNumber = active?.seasonNumber) {
    if (!seasonNumber) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/user-shows/${showId}?schedule=1&season=${seasonNumber}`,
        {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
        },
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.seasons))
        throw Error(data.error || "Не удалось загрузить расписание");
      if (controller.signal.aborted) return;
      setSchedule((previous) =>
        data.seasons.map((season: CalendarSeason) =>
          season.seasonNumber === seasonNumber
            ? season
            : previous?.find(
                (old) => old.seasonNumber === season.seasonNumber,
              ) || season,
        ),
      );
      if (!data.scheduleError) loadedSeasons.current.add(seasonNumber);
      setSelected((previous) => previous ?? seasonNumber);
      if (data.scheduleError)
        setError(
          "Не удалось обновить даты в TMDB. Показываем сохранённое расписание.",
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error && e.name === "Error"
            ? e.message
            : "Не удалось обновить расписание. Попробуйте ещё раз.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <section className="td-panel td-calendar" aria-label="Календарь серий">
      <button
        type="button"
        className="td-calendar-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          setOpen(!open);
          if (!open && !schedule && !loading) void load();
        }}
      >
        <span>
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" />
          </svg>
          Календарь серий
        </span>
        <span className="td-calendar-action">
          {open ? "Свернуть" : "Расписание"}{" "}
          <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </span>
      </button>
      {!open && (
        <p className="td-calendar-caption">
          {upcoming && validDay(upcoming.airDate)
            ? `Ближайшая: сезон ${upcoming.season}, серия ${upcoming.episode} · ${formatDay(upcoming.airDate)}`
            : "Даты выхода серий по сезонам"}
        </p>
      )}
      <div id={contentId} hidden={!open} aria-busy={loading}>
        <p className="td-calendar-caption">
          Даты оригинального выхода · по данным TMDB
        </p>
        {loading && (
          <p className="td-calendar-caption" role="status">
            Обновляем расписание…
          </p>
        )}
        {error && (
          <div className="td-calendar-error" role="alert">
            {error}{" "}
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
            >
              Повторить
            </button>
          </div>
        )}
        {!!available.length && (
          <div
            className="td-calendar-seasons"
            role="group"
            aria-label="Сезон календаря"
          >
            {available.map((season) => (
              <button
                type="button"
                key={season.seasonNumber}
                aria-pressed={active?.seasonNumber === season.seasonNumber}
                onClick={() => {
                  setSelected(season.seasonNumber);
                  if (!loadedSeasons.current.has(season.seasonNumber))
                    void load(season.seasonNumber);
                }}
              >
                Сезон {season.seasonNumber}
              </button>
            ))}
          </div>
        )}
        {!active && !loading && (
          <p className="td-calendar-caption">Расписание ещё не опубликовано.</p>
        )}
        <div
          className="td-calendar-list"
          role="list"
          aria-label={
            active ? `Расписание сезона ${active.seasonNumber}` : "Расписание"
          }
        >
          {active?.episodes.map((episode) => {
            const day = validDay(episode.airDate) ? episode.airDate : null;
            const future = day && day > today;
            return (
              <div
                className="td-calendar-episode"
                role="listitem"
                key={episode.id}
              >
                {day ? (
                  <time dateTime={day} className="td-calendar-date">
                    <strong>{Number(day.slice(8))}</strong>
                    <span>{formatDay(day, { month: "short" })}</span>
                    <small>{day.slice(0, 4)}</small>
                  </time>
                ) : (
                  <span className="td-calendar-date">
                    <strong>—</strong>
                    <span>дата</span>
                  </span>
                )}
                <div className="td-calendar-copy">
                  <strong>
                    Сезон {episode.season} · Серия {episode.episode}
                  </strong>
                  {episode.name && <span>{episode.name}</span>}
                </div>
                <span className="td-calendar-state" data-future={!!future}>
                  {!day
                    ? "Уточняется"
                    : day === today
                      ? "Сегодня"
                      : day === addDays(today, 1)
                        ? "Завтра"
                        : future
                          ? "Ожидается"
                          : "Вышла"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
