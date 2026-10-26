"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import CastList from "@/components/CastList";
import ShowDetails from "@/components/ShowDetails";
import CommentSection from "@/components/CommentSection";
import TrailerPlayer, { type TrailerItem } from "@/components/TrailerPlayer";
import {
  PersonalNotes,
  TitleControls,
  TitleRatings,
} from "@/components/TitlePersonal";
import "@/components/title-detail.css";

type PersonalRecord = {
  id: number;
  status: string;
  isFavorite: boolean;
  dubbing?: string | null;
  watchSite?: string | null;
  userRating?: number | null;
  ratings?: { episodeId: number | null; score: number }[];
};

type ShowData = {
  id: number;
  name?: string;
  title?: string;
  originalName?: string | null;
  originalTitle?: string | null;
  kind: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  year?: string;
  genres?: string[];
  runtime?: number;
  tmdbRating?: number | null;
  description?: string;
  trailers?: { russian: TrailerItem | null; english: TrailerItem | null };
  cast?: {
    id: number;
    name: string;
    character?: string;
    profileUrl?: string | null;
    image?: string | null;
  }[];
  comments?: unknown[];
};

export default function ShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const type = useSearchParams().get("type");
  const { data: session, status: authStatus } = useSession();
  return (
    <ShowContent
      key={`${id}:${type}:${authStatus}:${session?.user?.id}`}
      id={id}
      type={type}
      authStatus={authStatus}
    />
  );
}

function ShowContent({
  id,
  type,
  authStatus,
}: {
  id: string;
  type: string | null;
  authStatus: string;
}) {
  const router = useRouter();
  const [show, setShow] = useState<ShowData | null>(null);
  const [personal, setPersonal] = useState<PersonalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [section, setSection] = useState("about");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/shows/${encodeURIComponent(id)}${type ? `?type=${encodeURIComponent(type)}` : ""}`,
      { signal: abort.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить карточку");
        return response.json();
      })
      .then((data) => {
        setShow(data.show);
        const record = data.userShow;
        setPersonal(
          record
            ? {
                ...record,
                userRating:
                  record.ratings?.find(
                    (rating: { episodeId: number | null }) =>
                      rating.episodeId === null,
                  )?.score ?? null,
              }
            : null,
        );
      })
      .catch((error) => {
        if (!abort.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [id, type, reload, authStatus]);

  async function save(values: Record<string, unknown>) {
    if (authStatus !== "authenticated") {
      if (authStatus === "unauthenticated") router.push("/login");
      return false;
    }
    if (!show || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/user-shows/${show.id}`, {
        method: "PATCH",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(!personal ? { status: "planned" } : {}),
          ...values,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Войдите в аккаунт, чтобы сохранить изменения."
            : result.error || "Не удалось сохранить изменения",
        );
      setPersonal((previous) => ({
        ...previous,
        ...result.item,
        ...(values.score !== undefined
          ? { userRating: Number(values.score) }
          : {}),
      }));
      window.dispatchEvent(new Event("user-shows-updated"));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение. Обновите страницу перед повтором.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="title-detail td-panel" role="status">
        Загрузка карточки…
      </div>
    );
  if (loadError || !show)
    return (
      <div className="title-detail td-panel">
        <h1>Карточка недоступна</h1>
        <p className="td-description">{loadError || "Тайтл не найден"}</p>
        <button
          className="td-button"
          onClick={() => {
            setLoading(true);
            setLoadError("");
            setReload(reload + 1);
          }}
        >
          Повторить загрузку
        </button>
      </div>
    );
  const title = show.name || show.title;
  const original = show.originalName || show.originalTitle;
  const movie = show.kind === "movie";
  const disabled = busy || authStatus === "loading";
  return (
    <div className="title-detail">
      <nav className="td-breadcrumb" aria-label="Навигация карточки">
        <Link href="/watching">Библиотека</Link>
        <span aria-hidden="true">/</span>
        <span>{movie ? "Фильм" : "Сериал"}</span>
      </nav>
      <section className="td-hero td-panel" aria-label="Карточка тайтла">
        {show.backdropUrl && (
          <div
            className="td-backdrop"
            style={{
              backgroundImage: `url(${JSON.stringify(show.backdropUrl)})`,
            }}
          />
        )}
        {show.posterUrl /* eslint-disable-next-line @next/next/no-img-element */ ? (
          <img
            className="td-poster"
            src={show.posterUrl}
            alt={`Постер: ${title}`}
          />
        ) : (
          <div className="td-poster td-poster-empty">Нет постера</div>
        )}
        <div>
          <h1>{title}</h1>
          {original && original !== title && (
            <p className="td-original">{original}</p>
          )}
          <div className="td-meta">
            <span>{movie ? "Фильм" : "Сериал"}</span>
            {show.year && <span>{show.year}</span>}
            {!!show.genres?.length && <span>{show.genres.join(", ")}</span>}
            {(show.runtime ?? 0) > 0 && (
              <span>
                {Math.floor((show.runtime ?? 0) / 60) > 0
                  ? `${Math.floor((show.runtime ?? 0) / 60)} ч `
                  : ""}
                {(show.runtime ?? 0) % 60
                  ? `${(show.runtime ?? 0) % 60} мин`
                  : ""}
              </span>
            )}
          </div>
          <TitleRatings
            tmdb={show.tmdbRating}
            rating={personal?.userRating}
            busy={disabled}
            save={save}
          />
        </div>
        <div className="td-actions">
          {movie ? (
            <button
              className="td-button td-primary"
              disabled={disabled || personal?.status === "completed"}
              onClick={() => void save({ status: "completed" })}
            >
              {personal?.status === "completed"
                ? "✓ Просмотрено"
                : busy
                  ? "Сохранение…"
                  : "Отметить просмотренным"}
            </button>
          ) : (
            <Link
              className="td-button td-primary"
              href={
                authStatus === "authenticated"
                  ? `/library/${show.id}`
                  : "/login"
              }
            >
              Открыть трекер серий →
            </Link>
          )}
          <TitleControls value={personal} busy={disabled} save={save} />
          {show.trailers && <TrailerPlayer trailers={show.trailers} compact />}
        </div>
        {authStatus === "authenticated" && (
          <PersonalNotes
            key={show.id}
            value={personal}
            busy={disabled}
            save={save}
          />
        )}
      </section>
      {saveError && (
        <div className="td-alert" role="alert">
          {saveError}
        </div>
      )}
      {authStatus === "unauthenticated" && (
        <p className="td-muted mt-5">
          <Link className="underline" href="/login">
            Войдите
          </Link>
          , чтобы сохранять прогресс, оценки и заметки.
        </p>
      )}
      <nav className="td-tabs" aria-label="Разделы карточки">
        {[
          ["about", movie ? "О фильме" : "О сериале"],
          ["cast", "Актёры"],
          ["comments", "Обсуждение"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={section === key}
            aria-controls={`title-section-${key}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section id="title-section-about" hidden={section !== "about"}>
        <h2>{movie ? "О фильме" : "О сериале"}</h2>
        <p className="td-description">
          {show.description || "Описание пока не добавлено."}
        </p>
        <ShowDetails show={show} />
      </section>
      <section
        id="title-section-cast"
        hidden={section !== "cast"}
        className="td-panel"
      >
        {show.cast?.length ? (
          <CastList cast={show.cast} />
        ) : (
          <p className="td-muted">Информация об актёрах пока недоступна.</p>
        )}
      </section>
      <section id="title-section-comments" hidden={section !== "comments"}>
        <CommentSection
          key={show.id}
          showId={show.id}
          initialComments={show.comments || []}
        />
      </section>
    </div>
  );
}
