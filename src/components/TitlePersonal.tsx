"use client";

import { useId, useState } from "react";
import { libraryStatuses } from "@/lib/library";

export type PersonalValues = {
  status?: string;
  isFavorite?: boolean;
  dubbing?: string | null;
  watchSite?: string | null;
  userRating?: number | null;
};
export type SavePersonal = (
  values: Record<string, unknown>,
) => Promise<boolean>;

export function TitleControls({
  value,
  busy,
  save,
}: {
  value: PersonalValues | null;
  busy: boolean;
  save: SavePersonal;
}) {
  return (
    <div className="td-controls">
      <label className="td-status">
        <span className="sr-only">Статус просмотра</span>
        <select
          value={value?.status || ""}
          disabled={busy}
          onChange={(e) => void save({ status: e.target.value })}
        >
          <option value="" disabled>
            Добавить в библиотеку
          </option>
          {libraryStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="td-button td-favorite"
        aria-label={value?.isFavorite ? "Убрать из избранного" : "В избранное"}
        aria-pressed={!!value?.isFavorite}
        disabled={busy}
        onClick={() => void save({ isFavorite: !value?.isFavorite })}
      >
        <span aria-hidden="true">{value?.isFavorite ? "♥" : "♡"}</span>
        <span>В избранное</span>
      </button>
    </div>
  );
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
                  className="underline"
                >
                  {value} ↗
                </a>
              ) : (
                value || "Не указано"
              )}
            </span>
            <button
              className="td-text-button"
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
