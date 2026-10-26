"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useReleaseInbox from "@/components/useReleaseInbox";
import ReleaseNoticeList from "@/components/ReleaseNoticeList";
import ReleaseSettings from "@/components/ReleaseSettings";
import "@/components/releases.css";
export default function NotificationsPage() {
  const { data: session, status } = useSession();
  if (status === "loading") return <p role="status">Загрузка…</p>;
  return session?.user?.id ? (
    <Notifications key={session.user.id} />
  ) : (
    <div className="release-ui rc-panel">
      <h1>Уведомления</h1>
      <p className="rc-muted my-4">
        Войдите, чтобы получать уведомления о продолжениях.
      </p>
      <Link href="/login" className="rc-button rc-primary">
        Войти
      </Link>
    </div>
  );
}
function Notifications() {
  const [mode, setMode] = useState<"all" | "unread">("unread");
  return (
    <div className="release-ui rc-notifications-page">
      <div className="rc-heading">
        <h1>Уведомления</h1>
        <Link href="/calendar" className="rc-link">
          Календарь →
        </Link>
      </div>
      <div className="rc-tabs" aria-label="Фильтр уведомлений">
        <button
          aria-pressed={mode === "unread"}
          onClick={() => setMode("unread")}
        >
          Новые
        </button>
        <button aria-pressed={mode === "all"} onClick={() => setMode("all")}>
          Все
        </button>
      </div>
      <Inbox key={mode} mode={mode} />
    </div>
  );
}
function Inbox({ mode }: { mode: "all" | "unread" }) {
  const inbox = useReleaseInbox(mode);
  return (
    <>
      <div className="rc-heading">
        <p className="rc-muted">
          {inbox.data
            ? `Непрочитанных: ${inbox.data.unreadCount}`
            : "Проверяем уведомления…"}
        </p>
        <button
          className="rc-text"
          disabled={inbox.saving || !inbox.data?.unreadCount}
          onClick={() => void inbox.read()}
        >
          Прочитать все
        </button>
      </div>
      {inbox.error && (
        <div className="rc-error" role="alert">
          {inbox.error}
          <button className="rc-text" onClick={() => void inbox.refresh()}>
            Повторить загрузку
          </button>
        </div>
      )}
      {inbox.loading && !inbox.data && (
        <p role="status">Загрузка уведомлений…</p>
      )}
      {inbox.data && (
        <>
          <ReleaseNoticeList
            items={inbox.data.items}
            saving={inbox.saving}
            read={inbox.read}
          />
          {!inbox.data.items.length && (
            <section className="rc-panel rc-empty">
              <h2>
                {mode === "unread"
                  ? "Новых уведомлений нет"
                  : "Здесь появятся продолжения"}
              </h2>
              <p className="rc-muted">
                Включите колокольчик рядом с сериалом в календаре или трекере.
                Уведомления начинаются с даты подписки.
              </p>
              <Link className="rc-link" href="/calendar">
                Открыть календарь →
              </Link>
            </section>
          )}
          {inbox.data.nextCursor && (
            <button
              className="rc-button mt-4"
              disabled={inbox.loading || inbox.saving}
              onClick={() => void inbox.more()}
            >
              Показать ещё
            </button>
          )}
          <ReleaseSettings
            key={`${inbox.data.preferences.releaseNotificationsEnabled}:${inbox.data.preferences.notifyNewShows}`}
            initial={inbox.data.preferences}
          />
        </>
      )}
      <p className="rc-muted mt-6">
        Даты оригинального выхода могут меняться. Перевод может появиться позже.
        Уведомления обновляются, когда вы открываете сайт.
      </p>
    </>
  );
}
