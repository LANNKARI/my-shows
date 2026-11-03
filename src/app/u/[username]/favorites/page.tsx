"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import FavoriteGrid from "@/components/FavoriteGrid";
import { privateFetch } from "@/lib/private-fetch";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import type { FavoriteTitle } from "@/lib/favorites";
import "@/components/favorites.css";
type Data = { user: { username: string; name: string | null }; isOwnProfile: boolean; items: FavoriteTitle[] };
export default function FavoritesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return <Favorites key={username} username={username} />;
}
function Favorites({ username }: { username: string }) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<FavoriteTitle[]>([]), [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const lock = useRef(false), dragging = useRef<number | null>(null);
  const endpoint = `/api/users/${encodeURIComponent(username)}/favorites`;
  useEffect(() => {
    const abort = new AbortController();
    privateFetch(endpoint, abort.signal).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить любимые тайтлы");
      if (!abort.signal.aborted) { setData(result); setDraft(result.items); setError(""); setEditing(false); }
    }).catch(error => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "Ошибка соединения"); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [endpoint, reload]);
  function move(id: number, target: number) {
    if (lock.current) return;
    setDraft(items => {
      const from = items.findIndex(item => item.id === id), to = items.findIndex(item => item.id === target);
      if (from < 0 || to < 0 || from === to) return items;
      const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); return next;
    });
  }
  function moveArrow(id: number, target: number, direction: "up" | "down") {
    move(id, target);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-favorite-id="${id}"]`);
      const buttons = row?.querySelectorAll<HTMLButtonElement>(".favorite-arrow");
      if (!buttons?.length) return;
      const preferred = buttons[direction === "up" ? 0 : 1];
      (preferred.disabled ? buttons[direction === "up" ? 1 : 0] : preferred).focus({ preventScroll: true });
    });
  }
  async function save() {
    if (lock.current || !data?.isOwnProfile) return;
    lock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/favorites/order", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: draft.map(item => item.id), previousIds: data.items.map(item => item.id) }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить порядок");
      const items = draft.map((item, index) => ({ ...item, rank: index + 1 }));
      setData({ ...data, items }); setDraft(items); setEditing(false); setNotice("Порядок сохранён. Первые пять тайтлов отображаются в профиле.");
      window.dispatchEvent(new Event("user-shows-updated"));
    } catch (error) { setError(error instanceof Error && error.name === "Error" ? error.message : "Не удалось подтвердить сохранение. Обновите список перед повтором."); }
    finally { lock.current = false; setSaving(false); }
  }
  const changed = !!data && draft.some((item, index) => item.id !== data.items[index]?.id);
  return <div className="favorites-page">
    <Link className="favorite-button favorite-back" href={`/u/${encodeURIComponent(username)}`}>← Назад в профиль</Link>
    <div className="favorite-section-heading"><div><h1>Любимые фильмы и сериалы</h1><p className="favorite-muted">@{username}{data ? ` · ${data.items.length} тайтлов · Первые пять видны в профиле` : ""}</p></div>
      {data?.isOwnProfile && data.items.length > 1 && (editing ? <div className="favorite-tools"><button className="favorite-button" disabled={saving} onClick={() => { setDraft(data.items); setEditing(false); setError(""); }}>Отмена</button><button className="favorite-button favorite-primary" disabled={saving || !changed} onClick={() => void save()}>{saving ? "Сохраняем…" : "Сохранить порядок"}</button></div> : <button className="favorite-button" onClick={() => { setDraft(data.items); setEditing(true); setNotice(""); }}>↕ Изменить порядок</button>)}
    </div>
    {loading && <p role="status">Загрузка любимых тайтлов…</p>}
    {notice && <p role="status" className="favorite-hint">{notice}</p>}
    {error && <div role="alert" className="favorite-hint">{error} <button className="favorite-button" disabled={saving} onClick={() => { setLoading(true); setReload(value => value + 1); }}>Обновить список</button></div>}
    {data && !data.items.length && <div className="favorite-hint">Любимых тайтлов пока нет. Их можно добавить кнопкой «Любимый» в карточке или трекере.</div>}
    {data && !editing && <FavoriteGrid items={data.items} />}
    {data?.isOwnProfile && editing && <>
      <p className="favorite-hint">Перетаскивайте тайтлы за ⠿ или используйте стрелки. Первые пять появятся в профиле.</p>
      <ol className="favorite-order-list" aria-label="Порядок любимых тайтлов">{draft.map((item, index) => <li key={item.id} data-favorite-id={item.id} className="favorite-order-row" aria-label={`${index + 1}. ${item.name}`}>
        <button className="favorite-grip" type="button" disabled={saving} aria-label={`Переместить: ${item.name}`} title="Перетащите или используйте стрелки справа" onPointerDown={event => { if (saving || event.button !== 0) return; dragging.current = item.id; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
          if (dragging.current !== item.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-favorite-id]");
          if (target?.dataset.favoriteId) move(item.id, Number(target.dataset.favoriteId));
        }} onPointerUp={event => { dragging.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { dragging.current = null; }}>⠿</button>
        <span className="favorite-order-rank">#{index + 1}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- Existing external posters. */}
        {item.posterUrl && <img loading="lazy" src={tmdbImageUrl(item.posterUrl)} alt="" className="favorite-order-poster" />}
        <div className="favorite-order-name">{item.name}<span>{item.kind === "movie" ? "Фильм" : "Сериал"}{item.year ? ` · ${item.year}` : ""}</span></div>
        <button className="favorite-arrow" disabled={saving || index === 0} aria-label={`Поднять: ${item.name}`} onClick={() => moveArrow(item.id, draft[index - 1].id, "up")}>↑</button>
        <button className="favorite-arrow" disabled={saving || index === draft.length - 1} aria-label={`Опустить: ${item.name}`} onClick={() => moveArrow(item.id, draft[index + 1].id, "down")}>↓</button>
      </li>)}</ol>
    </>}
  </div>;
}
