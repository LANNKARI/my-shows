"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { libraryStatuses } from "@/lib/library";

export type PersonalValues = {
  status?: string;
  isFavorite?: boolean;
  isBookmarked?: boolean;
  dubbing?: string | null;
  watchSite?: string | null;
  userRating?: number | null;
};
export type SavePersonal = (
  values: Record<string, unknown>,
) => Promise<boolean>;

type PersonalControlProps = { value: PersonalValues | null; busy: boolean; save: SavePersonal };

export function TitleLibraryLinks() {
  return <nav className="td-library-links" aria-label="Личные списки">
    <Link href="/watching">Библиотека</Link>
    <Link href="/watching?status=bookmarked">♡ Избранное</Link>
    <Link href="/watching?status=favorites">★ Любимые</Link>
  </nav>;
}

export function TitleControls({ value, busy, save }: PersonalControlProps) {
  return (
    <div className="compact-tabs td-status-tabs" role="group" aria-label="Статус просмотра">
      {libraryStatuses.map((status) => (
        <button key={status.value} type="button" disabled={busy}
          aria-pressed={value?.status === status.value}
          onClick={() => void save({ status: status.value })}>
          {status.label}
        </button>
      ))}
    </div>
  );
}

export function PosterFavorite({ value, busy, save }: PersonalControlProps) {
  const saved = !!value?.isBookmarked;
  return <button type="button" className="td-poster-heart"
    aria-label={saved ? "Убрать из избранного" : "В избранное"}
    aria-pressed={saved} disabled={busy}
    onClick={() => void save({ isBookmarked: !saved })}>
    <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
  </button>;
}

export function LovedTitleButton({ value, busy, save }: PersonalControlProps) {
  const loved = !!value?.isFavorite;
  return <button type="button" className="td-button td-loved"
    aria-label={loved ? "Убрать из любимых" : "Добавить в любимые"}
    aria-pressed={loved} disabled={busy}
    onClick={() => void save({ isFavorite: !loved })}>
    <span aria-hidden="true">{loved ? "★" : "☆"}</span> Любимый
  </button>;
}

export function TitleRatings({
  tmdb,
  rating,
  busy,
  save,
}: {
  tmdb?: number | null;
  rating?: number | null;
  busy: boolean;
  save: SavePersonal;
}) {
  return (
    <div className="td-ratings">
      <div className="td-rating">
        <span>TMDB</span>
        <strong>
          <i aria-hidden="true">★</i> {tmdb && tmdb > 0 ? tmdb.toFixed(1) : "—"}
        </strong>
      </div>
      <label className="td-rating">
        <span>Моя оценка</span>
        <select
          aria-label="Моя оценка"
          value={rating || ""}
          disabled={busy}
          onChange={(e) => void save({ score: Number(e.target.value) })}
        >
          <option value="" disabled>
            — / 10
          </option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
            <option key={score} value={score}>
              {score} / 10
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function watchSiteHref(value?: string | null) {
  if (!value) return null;
  try {
    const candidate = value.trim();
    if (
      !/^https?:\/\//i.test(candidate) &&
      !/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(candidate)
    )
      return null;
    const url = new URL(
      /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function NoteField({
  label,
  value,
  field,
  placeholder,
  busy,
  save,
}: {
  label: string;
  value?: string | null;
  field: string;
  placeholder: string;
  busy: boolean;
  save: SavePersonal;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const id = useId();
  const href = field === "watchSite" ? watchSiteHref(value) : null;
  return (
    <div className="td-note-field">
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save({ [field]: draft.trim() })) setEditing(false);
          }}
        >
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            className="td-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            maxLength={500}
            disabled={busy}
            autoFocus
          />
          <div className="td-inline">
            <button className="td-button td-primary" disabled={busy}>
              Сохранить
            </button>
            <button
              type="button"
              className="td-button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="td-muted">{label}</span>
          <div className="td-note-value">
            <span>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-button"
                >
                  {value} ↗
                </a>
              ) : (
                value || "Не указано"
              )}
            </span>
            <button
              className="td-edit-button"
              aria-label={`Изменить: ${label}`}
              disabled={busy}
              onClick={() => {
                setDraft(value || "");
                setEditing(true);
              }}
            >
              Изменить
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PersonalNotes({
  value,
  busy,
  save,
  collapsible = false,
}: {
  value: PersonalValues | null;
  busy: boolean;
  save: SavePersonal;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const fieldsId = useId();
  return (
    <section
      className={`td-panel td-notes ${collapsible ? "td-notes-collapsible" : ""}`}
      aria-label="Мои настройки"
    >
      {collapsible ? (
        <button
          className="td-notes-toggle"
          aria-expanded={open}
          aria-controls={fieldsId}
          onClick={() => setOpen(!open)}
        >
          Озвучка и место просмотра{" "}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      ) : (
        <h2>Мои настройки</h2>
      )}
      <div id={fieldsId} className={`td-note-fields ${open ? "is-open" : ""}`}>
        <NoteField
          label="Озвучка"
          field="dubbing"
          value={value?.dubbing}
          placeholder="Например, дубляж"
          busy={busy}
          save={save}
        />
        <NoteField
          label="Где смотрю"
          field="watchSite"
          value={value?.watchSite}
          placeholder="Название сервиса или ссылка"
          busy={busy}
          save={save}
        />
      </div>
    </section>
  );
}
