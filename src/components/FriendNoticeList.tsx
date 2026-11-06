"use client";
import Link from "next/link";
import type { FriendNotice } from "@/lib/release-types";
import CosmeticAvatar from "./CosmeticAvatar";
export default function FriendNoticeList({
  items,
  saving,
  respond,
}: {
  items: FriendNotice[];
  saving: boolean;
  respond: (id: number, action: "accept" | "decline") => Promise<boolean>;
}) {
  return (
    <div className="rc-notice-list">
      {items.map((item) => (
        <article
          key={item.id}
          className={`rc-notice ${item.read ? "" : "is-unread"}`}
          aria-label={`Заявка в друзья от ${item.user.name || item.user.username}`}
        >
          <span
            className="rc-unread-dot"
            aria-label={item.read ? "Прочитано" : "Не прочитано"}
          />
          <Link
            href={`/u/${item.user.username}`}
            aria-label={`Профиль ${item.user.name || item.user.username}`}
          >
            <CosmeticAvatar
              size={45}
              name={item.user.name || item.user.username}
              src={item.user.avatarUrl}
            />
          </Link>
          <div className="rc-notice-content">
            <h3>
              <Link href={`/u/${item.user.username}`}>
                {item.user.name || item.user.username}
              </Link>{" "}
              хочет добавить вас в друзья
            </h3>
            <p className="rc-muted">
              @{item.user.username} ·{" "}
              <time dateTime={item.createdAt}>
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(item.createdAt))}
              </time>
            </p>
            <div className="rc-friend-actions">
              <button
                className="rc-button rc-primary"
                disabled={saving}
                onClick={() => void respond(item.id, "accept")}
              >
                Принять заявку
              </button>
              <button
                className="rc-button"
                disabled={saving}
                onClick={() => void respond(item.id, "decline")}
              >
                Отклонить
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
