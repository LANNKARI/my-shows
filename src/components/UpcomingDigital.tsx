"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DigitalPremiere } from "@/lib/upcoming-digital";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import "./upcoming-digital.css";
const place = (item: DigitalPremiere) => {
  if (item.platform) return item.platform;
  if (item.country === "US") return "США";
  if (item.country === "GB") return "Великобритания";
  if (!item.country || item.country === "XX") return "Мир";
  try { return new Intl.DisplayNames(["ru"], { type: "region" }).of(item.country) || item.country; } catch { return item.country; }
};
const daysUntil = (date: string, today: string) => {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  return days <= 0 ? "Сегодня" : `Через ${days} ${days % 10 === 1 && days % 100 !== 11 ? "день" : days % 10 >= 2 && days % 10 <= 4 && !(days % 100 >= 12 && days % 100 <= 14) ? "дня" : "дней"}`;
};
export default function UpcomingDigital() {
  const [items, setItems] = useState<DigitalPremiere[] | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [today, setToday] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const gesture = useRef({ active: false, moved: false, pointerId: 0, x: 0, scroll: 0 });
  useEffect(() => {
    const update = () => setToday(new Date().toISOString().slice(0, 10));
    update(); const timer = setInterval(update, 60000); return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!today) return;
    const abort = new AbortController();
    fetch("/api/upcoming-digital", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(22000)]) })
      .then(async response => { const data = await response.json(); if (!response.ok || !Array.isArray(data.items)) throw Error("Не удалось загрузить цифровые премьеры."); return data.items as DigitalPremiere[]; })
      .then(items => { if (!abort.signal.aborted) { setItems(items); setError(""); } })
      .catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить цифровые премьеры."); });
    return () => abort.abort();
  }, [attempt, today]);
  const visible = items?.filter(item => !today || item.date >= today);
  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    gesture.current.active = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <section className="digital-premieres" aria-labelledby="digital-heading">
    <div className="digital-heading"><div><h2 id="digital-heading">Скоро выходит в цифре</h2><p>Первые цифровые релизы · Ближайшие даты — сначала</p></div><span className="digital-drag-hint" aria-hidden="true">↔ Потяните карточки, чтобы листать</span></div>
    {error && <p role="alert" className="digital-message">{error} <button className="action-button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Повторить загрузку</button></p>}
    {!items && !error && <p className="digital-message" role="status">Проверяем даты цифровых премьер…</p>}
    {visible?.length === 0 && !error && <p className="digital-message">Подтверждённых цифровых премьер на ближайшее время пока нет.</p>}
    {!!visible?.length && <div className="digital-track-wrap"><div ref={rail} role="list" tabIndex={0} aria-label="Предстоящие цифровые премьеры. Листайте свайпом, перетаскиванием или клавишами со стрелками." className="digital-track"
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => { if (event.pointerType !== "mouse" || event.button !== 0) return; gesture.current = { active: true, moved: false, pointerId: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft }; }}
      onPointerMove={event => {
        const state = gesture.current;
        if (!state.active || state.pointerId !== event.pointerId) return;
        const delta = event.clientX - state.x;
        if (!state.moved && Math.abs(delta) <= 5) return;
        state.moved = true; event.currentTarget.dataset.dragging = "true";
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft = state.scroll - delta;
      }}
      onPointerUp={endGesture} onPointerCancel={endGesture} onLostPointerCapture={event => { gesture.current.active = false; delete event.currentTarget.dataset.dragging; }}
      onClickCapture={event => { if (gesture.current.moved && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.currentTarget, card = target.firstElementChild as HTMLElement | null;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); target.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * ((card?.offsetWidth || 340) + 16), behavior: "smooth" }); }
        if (event.key === "Home" || event.key === "End") { event.preventDefault(); target.scrollTo({ left: event.key === "Home" ? 0 : target.scrollWidth, behavior: "smooth" }); }
      }}>
      {visible.map(item => {
        const date = new Date(item.date + "T12:00:00Z"), country = place(item);
        return <article role="listitem" key={`${item.kind}-${item.id}`}><Link draggable={false} className="digital-card" href={`/show/${item.id}?source=tmdb&type=${item.kind === "movie" ? "movie" : "tv"}`} aria-label={`${item.title}, ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, ${country}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Existing TMDB artwork via the shared image proxy. */}
          <img draggable={false} src={tmdbImageUrl(item.imageUrl)} alt="" loading="lazy" />
          <time className="digital-date" dateTime={item.date}><strong>{date.getUTCDate()}</strong><span>{date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).split(" ").slice(1).join(" ")}</span></time>
          <span className="digital-kind">{item.kind === "movie" ? "Фильм" : "Сериал"}</span>
          <div className="digital-copy"><small>{item.kind === "movie" ? "Цифровой релиз" : "Премьера на стриминге"} · {country}</small><h3>{item.title}</h3><p>{today ? daysUntil(item.date, today) : ""}</p></div>
        </Link></article>;
      })}
    </div></div>}
    <p className="digital-source">По данным TMDB · Первый релиз в мире · Даты могут измениться</p>
  </section>;
}
