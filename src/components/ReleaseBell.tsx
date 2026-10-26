"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NavigationIcon from "./NavigationIcon";
import useReleaseInbox from "./useReleaseInbox";
import ReleaseNoticeList from "./ReleaseNoticeList";
import "./releases.css";
export default function ReleaseBell() {
  const { data: session } = useSession();
  return session?.user?.id ? <Bell key={session.user.id} /> : null;
}
function Bell() {
  const [mode, setMode] = useState<"all" | "unread">("unread");
  const inbox = useReleaseInbox(mode),
    [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const close = () => {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const controls = panel.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href]",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  return (
    <div ref={root} className="release-ui rc-bell-wrap">
      <button
        ref={trigger}
        aria-label={`Уведомления${inbox.data?.unreadCount ? `: ${inbox.data.unreadCount} новых` : ""}`}
        aria-expanded={open}
        onClick={() => {
          if (window.matchMedia("(max-width: 1279px)").matches)
            router.push("/notifications");
          else setOpen(!open);
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 text-neutral-300 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-rose-400"
      >
        <NavigationIcon name="bell" className="h-5 w-5" />
        {!!inbox.data?.unreadCount && (
          <span className="rc-badge">
            {inbox.data.unreadCount > 99 ? "99+" : inbox.data.unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="rc-inbox-popover"
          ref={panel}
          role="dialog"
          aria-label="Уведомления"
          tabIndex={-1}
        >
          <div className="rc-heading">
            <h2>Уведомления</h2>
            <button
              className="rc-text"
              disabled={inbox.saving || !inbox.data?.unreadCount}
              onClick={() => void inbox.read()}
            >
              Прочитать все
            </button>
          </div>
          <div className="rc-tabs mb-4" aria-label="Фильтр уведомлений">
            <button
              aria-pressed={mode === "unread"}
              onClick={() => setMode("unread")}
            >
              Новые {inbox.data?.unreadCount || ""}
            </button>
            <button
              aria-pressed={mode === "all"}
              onClick={() => setMode("all")}
            >
              Все
            </button>
          </div>
          {inbox.error && (
            <p role="alert" className="rc-error">
              {inbox.error}
            </p>
          )}
          {inbox.loading && !inbox.data && (
            <p role="status">Загрузка уведомлений…</p>
          )}
          {inbox.data && (
            <>
              <ReleaseNoticeList
                items={inbox.data.items.slice(0, 3)}
                saving={inbox.saving}
                read={inbox.read}
              />
              {!inbox.data.items.length && (
                <p className="rc-muted rc-empty">Новых уведомлений пока нет.</p>
              )}
            </>
          )}
          {inbox.error && (
            <button className="rc-button" onClick={() => void inbox.refresh()}>
              Повторить загрузку
            </button>
          )}
          <p className="rc-muted mt-4">
            Уведомления о датах оригинального выхода внутри сайта.
          </p>
          <Link
            className="rc-link"
            href="/notifications"
            onClick={() => setOpen(false)}
          >
            Все уведомления и настройки →
          </Link>
        </div>
      )}
    </div>
  );
}
