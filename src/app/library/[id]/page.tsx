"use client";

import { use, useEffect, useRef, useState } from "react";
import PersonalNoteEditor from "@/components/PersonalNoteEditor";
import ReleaseFollowButton from "@/components/ReleaseFollowButton";
import "@/components/releases.css";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  PersonalNotes,
  TitleControls,
  TitleRatings,
  type PersonalValues,
} from "@/components/TitlePersonal";
import useQuickProgress, {
  type ProgressPatch,
} from "@/components/useQuickProgress";
import { type LibraryItem } from "@/lib/library";
import "@/components/title-detail.css";

type Episode = {
  id: number;
  season: number;
  episode: number;
  watched: boolean;
  stoppedAt: string | null;
};
type Season = {
  seasonNumber: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  isCompleted: boolean;
  episodes: Episode[];
};
type TrackerData = {
  userShow: PersonalValues & {
    id: number;
    showId: number;
    kind: string;
    notifyReleases?: boolean;
    status: string;
    updatedAt: string;
  };
  show: {
    id: number;
    title: string;
    originalTitle?: string | null;
    originalName?: string | null;
    posterUrl: string | null;
    year: string | null;
    kind: string;
    genres: string[];
    tmdbRating: number | null;
  };
  stats: {
    totalEpisodes: number;
    watchedEpisodesCount: number;
    progressPercent: number;
  };
  seasons: Season[];
};

function withProgress(data: TrackerData, patch: ProgressPatch): TrackerData {
  const progress = new Map(
    patch.progress.map((value) => [value.episodeId, value]),
  );
  const seasons = data.seasons.map((season) => {
    const episodes = season.episodes.map((episode) => ({
      ...episode,
      watched: progress.get(episode.id)?.watched ?? false,
      stoppedAt: progress.get(episode.id)?.stoppedAt ?? null,
    }));
    const watchedEpisodes = episodes.filter(
      (episode) => episode.watched,
    ).length;
    return {
      ...season,
      episodes,
      watchedEpisodes,
      isCompleted: watchedEpisodes === episodes.length && episodes.length > 0,
    };
  });
  const watchedEpisodesCount = seasons.reduce(
    (sum, season) => sum + season.watchedEpisodes,
    0,
  );
  return {
    ...data,
    userShow: {
      ...data.userShow,
      status: patch.status,
      updatedAt: patch.updatedAt,
    },
    seasons,
    stats: {
      ...data.stats,
      watchedEpisodesCount,
      progressPercent:
        data.stats.totalEpisodes > 0
          ? Math.min(
              100,
              Math.round(
                (watchedEpisodesCount / data.stats.totalEpisodes) * 100,
              ),
            )
          : 0,
    },
  };
}

export default function LibraryTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  if (status === "loading")
    return (
      <div className="title-detail td-panel" role="status">
        Загрузка трекера…
      </div>
    );
  if (!session?.user)
    return (
      <div className="title-detail td-panel">
        <h1>Войдите, чтобы открыть трекер</h1>
        <Link className="td-button td-primary mt-5" href="/login">
          Войти
        </Link>
      </div>
    );
  return (
    <TrackerContent
      key={`${id}:${session.user.id}`}
      id={id}
      userId={session.user.id}
    />
  );
}

function TrackerContent({ id, userId }: { id: string; userId: string }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const undoButton = useRef<HTMLButtonElement>(null);
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({});
  const [expandedSeasons, setExpandedSeasons] = useState<
    Record<number, boolean>
  >({});
  const [confirmSeason, setConfirmSeason] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState<Episode | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [reload, setReload] = useState(0);
  const quick = useQuickProgress(userId, (patch) =>
    setData((previous) =>
      previous ? withProgress(previous, patch) : previous,
    ),
  );

  useEffect(() => {
    if (quick.undo?.focus) undoButton.current?.focus({ preventScroll: true });
  }, [quick.undo]);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/user-shows/${encodeURIComponent(id)}`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Войдите в аккаунт, чтобы открыть трекер."
              : "Не удалось загрузить трекер",
          );
        return response.json();
      })
      .then((json: TrackerData) => {
        setData(json);
        setConfirmSeason(null);
        setEditingTime(null);
        setSaveError("");
        const current =
          json.seasons.find((season) => !season.isCompleted) || json.seasons[0];
        setOpenSeasons(current ? { [current.seasonNumber]: true } : {});
        setExpandedSeasons({});
      })
      .catch((error) => {
        if (!abort.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [id, reload]);

  async function mutate(
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    if (!data || lock.current || quick.pending) return false;
    lock.current = true;
    setBusy(true);
    setSaveError("");
    try {
      // This legacy endpoint takes Show.id; quick-progress takes UserShow.id.
      const response = await fetch(`/api/user-shows/${data.show.id}`, {
        method,
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось сохранить изменения");
      quick.dismiss();
      if (method === "PATCH") {
        setData((previous) => {
          if (!previous) return previous;
          const updated = {
            ...previous,
            userShow: {
              ...previous.userShow,
              ...result.item,
              ...(body.score !== undefined
                ? { userRating: Number(body.score) }
                : {}),
            },
          };
          return result.item.progress
            ? withProgress(updated, {
                userShowId: result.item.id,
                status: result.item.status,
                updatedAt: result.item.updatedAt,
                progress: result.item.progress,
              })
            : updated;
        });
      } else {
        const fresh = await fetch(`/api/user-shows/${data.show.id}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!fresh.ok)
          throw new Error(
            "Изменение отправлено, но проверить результат не удалось. Обновите трекер.",
          );
        setData(await fresh.json());
      }
      window.dispatchEvent(new Event("user-shows-updated"));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение. Обновите трекер перед повтором.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function refresh() {
    setLoading(true);
    setLoadError("");
    quick.dismiss();
    setReload(reload + 1);
  }
  const save = (body: Record<string, unknown>) => mutate("PATCH", body);
  function editTime(episode: Episode) {
    setEditingTime(episode);
    setTimeInput(episode.stoppedAt || "");
  }

  if (loading)
    return (
      <div className="title-detail td-panel" role="status">
        Загрузка трекера…
      </div>
    );
  if (!data || loadError)
    return (
      <div className="title-detail td-panel">
        <h1>Трекер недоступен</h1>
        <p className="td-description">{loadError || "Тайтл не найден"}</p>
        <div className="td-inline">
          <button className="td-button" onClick={refresh}>
            Повторить загрузку
          </button>
          <Link className="td-button" href="/login">
            Войти
          </Link>
          <Link className="td-button" href="/watching">
            Библиотека
          </Link>
        </div>
      </div>
    );
  const { show, userShow, stats, seasons } = data;
  const episodes = seasons.flatMap((season) => season.episodes);
  const next = episodes.find((episode) => !episode.watched);
  const disabled = busy || !!quick.pending;
  const item: LibraryItem = {
    id: show.id,
    showId: show.id,
    userShowId: userShow.id,
    title: show.title,
    kind: show.kind,
    status: userShow.status,
    updatedAt: userShow.updatedAt,
    totalEpisodes: stats.totalEpisodes,
    show: { id: show.id, episodes },
    ratings: [],
    progress: episodes.map((episode) => ({
      episodeId: episode.id,
      watched: episode.watched,
      stoppedAt: episode.stoppedAt,
    })),
  };
  const canQuick = userShow.status === "watching" && !!userId;
  async function markNext() {
    if (lock.current) return;
    setSaveError("");
    await quick.mark(item);
  }
  const poster =
    show.posterUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
      <img
        className="td-poster"
        src={show.posterUrl}
        alt={`Постер: ${show.title}`}
      />
    ) : (
      <div className="td-poster td-poster-empty">Нет постера</div>
    );
  return (
    <div className="title-detail">
      <nav className="td-breadcrumb" aria-label="Навигация трекера">
        <Link href="/watching">Библиотека</Link>
        <span aria-hidden="true">/</span>
        <span>Трекер</span>
      </nav>
      <div className="td-tracker">
        <aside className="td-tracker-side">
          {poster}
          <PersonalNotes value={userShow} busy={disabled} save={save} />
          <Link className="td-text-button block mt-4" href={`/show/${show.id}`}>
            Открыть карточку {show.kind === "movie" ? "фильма" : "сериала"} →
          </Link>
        </aside>
        <section className="td-tracker-header" aria-label="Тайтл и статус">
          {poster}
          <div>
            <h1>{show.title}</h1>
            {(show.originalTitle || show.originalName) && (
              <p className="td-original">
                {show.originalTitle || show.originalName}
              </p>
            )}
            <div className="td-meta">
              {show.year && <span>{show.year}</span>}
              <span>{show.genres?.join(", ")}</span>
            </div>
            <TitleControls value={userShow} busy={disabled} save={save} />
            <TitleRatings
              tmdb={show.tmdbRating}
              rating={userShow.userRating}
              busy={disabled}
              save={save}
            />
          </div>
        </section>
        <div className="td-tracker-content">
          <section className="td-panel" aria-label="Прогресс просмотра">
            <div className="td-progress-label">
              <span>
                Отмечено {stats.watchedEpisodesCount} из {stats.totalEpisodes}{" "}
                {show.kind === "movie" ? "частей" : "серий"}
              </span>
              <strong>{stats.progressPercent}%</strong>
            </div>
            <div
              className="td-progress"
              role="progressbar"
              aria-label="Прогресс просмотра"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.progressPercent}
            >
              <div style={{ width: `${stats.progressPercent}%` }} />
            </div>
          </section>
          <section className="td-panel td-current" aria-label="Текущая серия">
            <h2>
              {next?.stoppedAt
                ? "Вы остановились здесь"
                : next
                  ? "Следующая серия"
                  : "Все доступные серии просмотрены"}
            </h2>
            {next ? (
              <>
                <div className="td-current-main">
                  <div>
                    <strong>
                      {show.kind === "movie"
                        ? show.title
                        : `Сезон ${next.season} · Серия ${next.episode}`}
                    </strong>
                    <span className="td-time">
                      {next.stoppedAt
                        ? `Время остановки: ${next.stoppedAt}`
                        : "Время остановки не указано"}
                    </span>
                  </div>
                  {canQuick ? (
                    <button
                      className="td-button td-primary"
                      disabled={disabled}
                      aria-busy={!!quick.pending}
                      onClick={() => void markNext()}
                    >
                      {quick.pending
                        ? "Сохранение…"
                        : show.kind === "movie"
                          ? "Отметить фильм"
                          : "Отметить серию"}
                    </button>
                  ) : (
                    <button
                      className="td-button"
                      disabled={disabled}
                      onClick={() => void save({ status: "watching" })}
                    >
                      Продолжить просмотр
                    </button>
                  )}
                </div>
                <button
                  className="td-text-button"
                  disabled={disabled}
                  onClick={() => editTime(next)}
                >
                  Изменить время
                </button>
              </>
            ) : (
              <p className="td-muted">
                {stats.watchedEpisodesCount < stats.totalEpisodes
                  ? "Ожидаем информацию об остальных сериях."
                  : "Прогресс сохранён. Отметки можно изменить в списке ниже."}
              </p>
            )}
          </section>
          {(quick.undo || quick.error) && (
            <aside
              className="td-notice"
              aria-label="Последнее изменение прогресса"
            >
              {quick.undo && (
                <>
                  <p role="status">{quick.undo.message}</p>
                  <button
                    className="td-text-button"
                    disabled={disabled}
                    ref={undoButton}
                    onClick={() => void quick.undoLast()}
                  >
                    Отменить отметку
                  </button>
                </>
              )}
              {quick.error && <p role="alert">{quick.error}</p>}
              <button
                className="td-text-button"
                disabled={disabled}
                onClick={refresh}
              >
                Обновить трекер
              </button>
            </aside>
          )}
          {saveError && (
            <div className="td-alert" role="alert">
              {saveError}
              <button
                className="td-text-button"
                disabled={disabled}
                onClick={refresh}
              >
                Обновить трекер
              </button>
            </div>
          )}
          {editingTime && (
            <form
              className="td-panel td-time-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const time = timeInput.trim();
                if (time && !/^\d{1,3}:(?:[0-5]\d:)?[0-5]\d$/.test(time)) {
                  setSaveError("Введите время в формате ММ:СС или ЧЧ:ММ:СС.");
                  return;
                }
                if (
                  await mutate("POST", {
                    episodeId: editingTime.id,
                    stoppedAt: time || null,
                  })
                )
                  setEditingTime(null);
              }}
            >
              <label htmlFor="episode-time">
                Время остановки: сезон {editingTime.season}, серия{" "}
                {editingTime.episode}
              </label>
              <input
                id="episode-time"
                className="td-input"
                value={timeInput}
                onChange={(event) => setTimeInput(event.target.value)}
                placeholder="18:42"
                autoFocus
                maxLength={12}
                disabled={disabled}
              />
              <button className="td-button td-primary" disabled={disabled}>
                Сохранить время
              </button>
              <button
                className="td-button"
                type="button"
                disabled={disabled}
                onClick={() => setEditingTime(null)}
              >
                Отмена
              </button>
              <p className="td-muted w-full">
                ММ:СС или ЧЧ:ММ:СС. Оставьте поле пустым, чтобы удалить время.
              </p>
            </form>
          )}
          <PersonalNoteEditor showId={show.id} />
          <div className="lg:hidden">
            <PersonalNotes
              value={userShow}
              busy={disabled}
              save={save}
              collapsible
            />
          </div>
          {show.kind === "series" && (
            <div className="release-ui">
              <ReleaseFollowButton
                key={`${userShow.id}:${userShow.notifyReleases}`}
                userShowId={userShow.id}
                enabled={!!userShow.notifyReleases}
                title={show.title}
              />
            </div>
          )}
          <section aria-label="Сезоны и серии">
            <h2>Сезоны и серии</h2>
            {seasons.length > 1 && (
              <div className="td-season-actions">
                <button
                  className="td-text-button"
                  onClick={() =>
                    setOpenSeasons(
                      Object.fromEntries(
                        seasons.map((season) => [season.seasonNumber, true]),
                      ),
                    )
                  }
                >
                  Развернуть все сезоны
                </button>
                <button
                  className="td-text-button"
                  onClick={() => setOpenSeasons({})}
                >
                  Свернуть все сезоны
                </button>
              </div>
            )}
            {!seasons.length && (
              <p className="td-muted mt-4">Список серий пока недоступен.</p>
            )}
            {seasons.map((season) => {
              const open = !!openSeasons[season.seasonNumber];
              const currentIndex = season.episodes.findIndex(
                (episode) => episode.id === next?.id,
              );
              const start = currentIndex < 5 ? 0 : currentIndex - 2;
              const visibleEpisodes = expandedSeasons[season.seasonNumber]
                ? season.episodes
                : season.episodes.slice(start, start + 5);
              return (
                <section
                  className="td-panel td-season"
                  key={season.seasonNumber}
                  aria-label={`Сезон ${season.seasonNumber}`}
                >
                  <div className="td-season-head">
                    <button
                      className="td-season-toggle"
                      aria-expanded={open}
                      aria-controls={`season-${season.seasonNumber}`}
                      onClick={() =>
                        setOpenSeasons((previous) => ({
                          ...previous,
                          [season.seasonNumber]: !open,
                        }))
                      }
                    >
                      <strong>Сезон {season.seasonNumber}</strong>
                      <span>
                        {season.watchedEpisodes} из {season.totalEpisodes}{" "}
                        просмотрено
                      </span>
                      <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
                    </button>
                    <button
                      className="td-text-button"
                      disabled={disabled}
                      onClick={() =>
                        setConfirmSeason(
                          confirmSeason === season.seasonNumber
                            ? null
                            : season.seasonNumber,
                        )
                      }
                    >
                      {season.isCompleted
                        ? "Снять отметки сезона"
                        : "Отметить сезон"}
                    </button>
                  </div>
                  {confirmSeason === season.seasonNumber && (
                    <div
                      className="td-confirm"
                      role="group"
                      aria-label="Подтверждение изменения сезона"
                    >
                      <p>
                        {season.isCompleted
                          ? "Снять отметки со всех серий"
                          : "Отметить просмотренными все серии"}{" "}
                        сезона {season.seasonNumber}?
                      </p>
                      <div className="td-inline">
                        <button
                          className="td-button td-primary"
                          autoFocus
                          disabled={disabled}
                          onClick={async () => {
                            if (
                              await mutate("POST", {
                                seasonNumber: season.seasonNumber,
                                markSeasonWatched: !season.isCompleted,
                              })
                            )
                              setConfirmSeason(null);
                          }}
                        >
                          Подтвердить
                        </button>
                        <button
                          className="td-button"
                          disabled={disabled}
                          onClick={() => setConfirmSeason(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                  <div id={`season-${season.seasonNumber}`} hidden={!open}>
                    {visibleEpisodes.map((episode) => (
                      <div
                        key={episode.id}
                        className={`td-episode ${episode.id === next?.id ? "is-current" : ""}`}
                      >
                        <button
                          className="td-episode-check"
                          role="checkbox"
                          aria-checked={episode.watched}
                          aria-label={`Сезон ${episode.season}, серия ${episode.episode}: просмотрено`}
                          disabled={disabled}
                          onClick={() => {
                            if (
                              !episode.watched &&
                              episode.id === next?.id &&
                              canQuick
                            )
                              void markNext();
                            else
                              void mutate("POST", {
                                episodeId: episode.id,
                                watched: !episode.watched,
                              });
                          }}
                        >
                          <span className="td-check" aria-hidden="true">
                            {episode.watched ? "✓" : ""}
                          </span>
                          <span>Серия {episode.episode}</span>
                        </button>
                        <div className="td-inline">
                          <span className="td-muted">
                            {episode.watched ? "Просмотрено" : ""}
                          </span>
                          <button
                            className="td-text-button"
                            aria-label={`Изменить время: сезон ${episode.season}, серия ${episode.episode}`}
                            title={
                              episode.watched
                                ? "Снимите отметку просмотра, чтобы указать время"
                                : "Изменить время"
                            }
                            disabled={disabled || episode.watched}
                            onClick={() => editTime(episode)}
                          >
                            {episode.stoppedAt || "+ Время"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {season.episodes.length > 5 && (
                      <button
                        className="td-show-more"
                        onClick={() =>
                          setExpandedSeasons((previous) => ({
                            ...previous,
                            [season.seasonNumber]:
                              !previous[season.seasonNumber],
                          }))
                        }
                      >
                        {expandedSeasons[season.seasonNumber]
                          ? "Свернуть список серий"
                          : `Показать все ${season.episodes.length} серий`}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </section>
          <Link className="td-text-button lg:hidden" href={`/show/${show.id}`}>
            Открыть карточку {show.kind === "movie" ? "фильма" : "сериала"} →
          </Link>
        </div>
      </div>
    </div>
  );
}
