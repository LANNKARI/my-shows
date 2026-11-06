"use client";
/* eslint-disable @next/next/no-img-element -- Artwork uses the existing TMDB image proxy. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AccountName, useAccount } from "./AccountAccess";
import { tmdbImageUrl } from "@/lib/tmdb-image";
type Show = {
  id: number;
  name: string;
  posterUrl: string | null;
  kind: string;
};
type Pick = {
  id: string;
  name: string;
  description: string;
  published: boolean;
  shows: Show[];
  user: { id: string; username: string };
};
export default function EditorialPicks({
  manage = false,
}: {
  manage?: boolean;
}) {
  const { account, loading } = useAccount();
  const [items, setItems] = useState<Pick[]>([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Show[]>([]),
    [selected, setSelected] = useState<Show[]>([]),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [id, setId] = useState<string | null>(null),
    [published, setPublished] = useState(false),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false);
  const lock = useRef(false);
  const allowed = !manage || account?.curate;
  useEffect(() => {
    if (!allowed) return;
    const a = new AbortController();
    fetch(`/api/picks?manage=${manage ? 1 : 0}&offset=${offset}`, {
      signal: a.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Не удалось загрузить");
        return d;
      })
      .then((d) => {
        if (!a.signal.aborted) {
          setItems(d.items);
          setMore(d.hasMore);
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [manage, allowed, revision, offset]);
  async function search() {
    setError("");
    try {
      const r = await fetch("/api/picks?q=" + encodeURIComponent(query));
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setResults(d.shows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    }
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          description,
          published,
          showIds: selected.map((s) => s.id),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setId(null);
      setName("");
      setDescription("");
      setSelected([]);
      setPublished(false);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка соединения");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (manage && loading) return <p role="status">Проверяем доступ…</p>;
  if (!allowed)
    return (
      <div className="account-ui">
        <h1>Подборки кураторов</h1>
        <p>Нужна роль куратора.</p>
      </div>
    );
  return (
    <div className="account-ui">
      <h1>{manage ? "Мои подборки куратора" : "Подборки кураторов"}</h1>
      <p className="account-muted">Рекомендации от команды EpisyHub.</p>
      {error && <p role="alert">{error}</p>}
      {manage && (
        <section className="account-panel account-form">
          <h2>{id ? "Редактировать подборку" : "Новая подборка"}</h2>
          <label>
            Название
            <input
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Описание
            <textarea
              className="account-field"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="account-actions">
            <input
              aria-label="Найти тайтл"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название тайтла"
            />
            <button
              className="account-button"
              disabled={query.trim().length < 2}
              onClick={() => void search()}
            >
              Найти тайтл
            </button>
          </div>
          {results.map((s) => (
            <button
              className="account-button"
              disabled={
                selected.some((x) => x.id === s.id) || selected.length >= 50
              }
              key={s.id}
              onClick={() => setSelected((p) => [...p, s])}
            >
              + {s.name}
            </button>
          ))}
          <p className="account-muted">
            Поиск по каталогу сайта. До 50 тайтлов в подборке; порядок — как в
            списке ниже.
          </p>
          {selected.map((s, index) => (
            <div className="account-line" key={s.id}>
              <span>
                {index + 1}. {s.name}
              </span>
              <div>
                <button
                  className="account-button"
                  disabled={index === 0}
                  onClick={() =>
                    setSelected((p) => {
                      const a = [...p];
                      [a[index - 1], a[index]] = [a[index], a[index - 1]];
                      return a;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  className="account-button"
                  onClick={() =>
                    setSelected((p) => p.filter((x) => x.id !== s.id))
                  }
                >
                  Убрать
                </button>
              </div>
            </div>
          ))}
          <label>
            <span>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />{" "}
              Опубликовать для всех
            </span>
          </label>
          <button
            className="account-button primary"
            disabled={busy || !name.trim() || !selected.length}
            onClick={() => void save()}
          >
            {busy ? "Сохранение…" : "Сохранить подборку"}
          </button>
        </section>
      )}
      {items.map((p) => (
        <section className="account-panel" key={p.id}>
          <div className="account-line">
            <h2>{p.name}</h2>
            {manage && (
              <button
                className="account-button"
                onClick={() => {
                  setId(p.id);
                  setName(p.name);
                  setDescription(p.description);
                  setPublished(p.published);
                  setSelected(p.shows);
                }}
              >
                Редактировать
              </button>
            )}
          </div>
          <p>{p.description}</p>
          <p className="account-muted">
            Куратор:{" "}
            <Link href={`/u/${p.user.username}`}>
              <AccountName userId={p.user.id}>@{p.user.username}</AccountName>
            </Link>
            {manage && !p.published ? " · Черновик" : ""}
          </p>
          <div className="pick-shows">
            {p.shows.map((s) => (
              <Link href={`/show/${s.id}`} key={s.id}>
                {s.posterUrl && (
                  <img src={tmdbImageUrl(s.posterUrl)} alt="" loading="lazy" />
                )}
                <strong>{s.name}</strong>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!items.length && <p>Опубликованных подборок пока нет.</p>}
      <div className="account-actions">
        <button
          className="account-button"
          disabled={!offset}
          onClick={() => setOffset((v) => Math.max(0, v - 20))}
        >
          ← Назад
        </button>
        <button
          className="account-button"
          disabled={!more}
          onClick={() => setOffset((v) => v + 20)}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
