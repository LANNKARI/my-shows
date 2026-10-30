"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { actorCreditKey, type ActorDetails } from "@/lib/actor-types";
import { privateFetch } from "@/lib/private-fetch";
import styles from "./page.module.css";

function Artwork({
  src,
  alt,
  label,
}: {
  src: string | null;
  alt: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </>
  ) : (
    <span className={styles.placeholder}>{label}</span>
  );
}
function LibraryMarks({
  actorId,
  userId,
  children,
}: {
  actorId: number;
  userId: string;
  children: (keys: Set<string>) => React.ReactNode;
}) {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    privateFetch(`/api/actors/${actorId}/library`, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setKeys(new Set(data.keys));
          setError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [actorId, userId, retry]);
  return (
    <>
      {error && (
        <p className={styles.hint} role="status">
          Не удалось проверить отметки библиотеки.{" "}
          <button
            onClick={() => setRetry((v) => v + 1)}
            className={styles.more}
          >
            Повторить
          </button>
        </p>
      )}
      {children(keys)}
    </>
  );
}
export default function ActorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ActorContent key={id} id={id} />;
}
function ActorContent({ id }: { id: string }) {
  const { data: session, status } = useSession();
  const [actor, setActor] = useState<ActorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("popular");
  const [limit, setLimit] = useState(24);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/actors/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setMissing(response.status === 404);
          throw Error(body.error || "Не удалось загрузить актёра");
        }
        return body as ActorDetails;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setActor(data);
          setError("");
          setMissing(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Ошибка соединения");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  const reload = () => {
    setError("");
    setLoading(true);
    setRetry((v) => v + 1);
  };
  if (loading)
    return (
      <div className={styles.page} role="status">
        <div className={styles.skeleton}>Загрузка страницы актёра…</div>
      </div>
    );
  if (error || !actor)
    return (
      <section className={styles.error}>
        <h1>{missing ? "Актёр не найден" : "Не удалось загрузить страницу"}</h1>
        <p role="alert">{error}</p>
        {!missing && (
          <button className="btn btn-primary" onClick={reload}>
            Повторить загрузку
          </button>
        )}
        <Link href="/" className={styles.more}>
          На главную
        </Link>
      </section>
    );
  const filtered = actor.credits
    .filter((c) => filter === "all" || c.kind === filter)
    .sort((a, b) => {
      if (sort !== "popular") {
        if (!a.releaseDate) return b.releaseDate ? 1 : 0;
        if (!b.releaseDate) return -1;
        const order = a.releaseDate.localeCompare(b.releaseDate);
        if (order) return sort === "new" ? -order : order;
      }
      return (
        b.popularity - a.popularity || a.title.localeCompare(b.title, "ru")
      );
    });
  const biography = actor.biography;
  const short =
    biography.length > 280
      ? biography.slice(0, 280).replace(/\s+\S*$/, "") + "…"
      : biography;
  const formatDate = (date: string) =>
    new Date(date + "T00:00:00Z").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const renderCredits = (keys: Set<string>) => (
    <>
      <div className={styles.grid}>
        {filtered.slice(0, limit).map((credit) => (
          <Link
            key={actorCreditKey(credit)}
            href={`/show/${credit.id}?type=${credit.kind === "series" ? "tv" : "movie"}&source=tmdb`}
            className={styles.card}
            aria-label={`${credit.title}, ${credit.kind === "movie" ? "фильм" : "сериал"}`}
          >
            <div className={styles.poster}>
              <Artwork
                key={credit.posterUrl}
                src={credit.posterUrl}
                alt=""
                label="Постер пока не добавлен"
              />
              {keys.has(actorCreditKey(credit)) && (
                <span className={styles.badge}>✓ В библиотеке</span>
              )}
              {credit.rating !== null && (
                <span className={styles.rating}>★ {credit.rating}</span>
              )}
            </div>
            <div className={styles.info}>
              <p className={styles.meta}>
                {credit.year ?? "Дата не объявлена"} ·{" "}
                {credit.kind === "movie" ? "Фильм" : "Сериал"}
              </p>
              <h3 title={credit.title}>{credit.title}</h3>
              <p className={styles.role}>
                {credit.roles.join(" / ") || "Роль не указана"}
              </p>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className={styles.empty}>В этой категории пока нет работ.</p>
      )}
      {filtered.length > limit && (
        <button className={styles.load} onClick={() => setLimit((n) => n + 24)}>
          Показать ещё ({filtered.length - limit})
        </button>
      )}
    </>
  );
  return (
    <div className={styles.page}>
      <nav className={styles.crumb} aria-label="Навигация по странице">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">/</span>
        <span>Актёры</span>
        <span aria-hidden="true">/</span>
        <span>{actor.name}</span>
      </nav>
      <section className={styles.hero} aria-labelledby="actor-name">
        <div className={styles.portrait}>
          <Artwork
            key={actor.profileUrl}
            src={actor.profileUrl}
            alt={actor.name}
            label="Фото пока нет"
          />
        </div>
        <div className={styles.details}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>Актёр</p>
            <h1 id="actor-name">{actor.name}</h1>
            {actor.originalName && (
              <p className={styles.original}>{actor.originalName}</p>
            )}
          </div>
          <div className={styles.facts}>
            {actor.birthday && (
              <span>Дата рождения: {formatDate(actor.birthday)}</span>
            )}
            {actor.deathday && (
              <span>Дата смерти: {formatDate(actor.deathday)}</span>
            )}
            {actor.birthplace && <span>{actor.birthplace}</span>}
          </div>
          <div className={styles.biography}>
            {actor.biographyLanguage === "en" && (
              <p className={styles.hint}>
                Биография на английском — перевод на русский пока отсутствует.
              </p>
            )}
            <p id="actor-biography" lang={actor.biographyLanguage ?? "ru"}>
              {biography
                ? expanded
                  ? biography
                  : short
                : "Биография пока не добавлена."}
            </p>
            {biography.length > 280 && (
              <button
                className={styles.more}
                aria-expanded={expanded}
                aria-controls="actor-biography"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Свернуть ↑" : "Читать полностью ↓"}
              </button>
            )}
          </div>
        </div>
      </section>
      <section aria-labelledby="filmography-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="filmography-title">Фильмы и сериалы</h2>
            <p className={styles.hint}>
              Работы с участием актёра · роль указана под названием
            </p>
          </div>
          <label className={styles.sort}>
            Сортировка
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setLimit(24);
              }}
            >
              <option value="popular">По популярности</option>
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
            </select>
          </label>
        </div>
        <div className={styles.filters} role="group" aria-label="Тип работ">
          {[
            { id: "all", label: "Все" },
            { id: "movie", label: "Фильмы" },
            { id: "series", label: "Сериалы" },
          ].map((option) => (
            <button
              key={option.id}
              aria-pressed={filter === option.id}
              onClick={() => {
                setFilter(option.id);
                setLimit(24);
              }}
            >
              {option.label} (
              {
                actor.credits.filter(
                  (c) => option.id === "all" || c.kind === option.id,
                ).length
              }
              )
            </button>
          ))}
        </div>
        {session?.user?.id && status === "authenticated" ? (
          <LibraryMarks
            key={`${id}:${session.user.id}`}
            actorId={actor.id}
            userId={session.user.id}
          >
            {renderCredits}
          </LibraryMarks>
        ) : (
          renderCredits(new Set())
        )}
        <p className={styles.source}>
          Сведения и изображения: TMDB. Фильмография отражает доступные данные
          источника.
        </p>
      </section>
    </div>
  );
}
