/* eslint-disable @next/next/no-img-element -- Existing catalogue posters use remote URLs and a plain image fallback. */
"use client";
import Link from "next/link";
import { formatDay } from "@/lib/calendar-dates";
import type { ReleaseNotice } from "@/lib/release-types";
export default function ReleaseNoticeList({
  items,
  saving,
  read,
}: {
  items: ReleaseNotice[];
  saving: boolean;
  read: (ids?: number[]) => Promise<boolean>;
}) {
  return (
    <div className="rc-notice-list">
      {items.map((item) => (
        <article
          key={item.id}
          className={`rc-notice ${item.read ? "" : "is-unread"}`}
          aria-label={`${item.title}: сезон ${item.season}, серия ${item.episode}`}
        >
          <span
            className="rc-unread-dot"
            aria-label={item.read ? "Прочитано" : "Не прочитано"}
          />
          {item.posterUrl ? (
            <img
              className="rc-poster"
              src={item.posterUrl}
              alt=""
            />
          ) : (
            <div className="rc-poster rc-no-poster" aria-hidden="true">
              TV
            </div>
          )}
          <div className="rc-notice-content">
            <h3>{item.title}</h3>
            <p>
              Сезон {item.season} · Серия {item.episode}
            </p>
            <p className="rc-muted">Дата выхода — {formatDay(item.date)}</p>
            <Link
              href={`/library/${item.showId}`}
              className="rc-link"
              onClick={() => {
                if (!item.read) void read([item.id]);
              }}
            >
              Открыть трекер →
            </Link>
            {!item.read && (
              <button
                className="rc-read-one"
                disabled={saving}
                onClick={() => void read([item.id])}
              >
                Прочитано
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
