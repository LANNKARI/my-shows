"use client";
import { useEffect, useRef, useState } from "react";
import NavigationIcon from "./NavigationIcon";
import { browserZone } from "@/lib/release-types";
export default function ReleaseFollowButton({
  userShowId,
  enabled,
  title,
  compact = false,
}: {
  userShowId: number;
  enabled: boolean;
  title: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(enabled),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (
        event as CustomEvent<{ userShowId: number; enabled: boolean }>
      ).detail;
      if (detail?.userShowId === userShowId) setValue(detail.enabled);
    };
    window.addEventListener("release-preferences-updated", update);
    return () =>
      window.removeEventListener("release-preferences-updated", update);
  }, [userShowId]);
  async function toggle() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/release-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userShowId,
          notifyReleases: !value,
          timeZone: browserZone(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось сохранить подписку");
      setValue(data.notifyReleases);
      window.dispatchEvent(
        new CustomEvent("release-preferences-updated", {
          detail: { userShowId, enabled: data.notifyReleases },
        }),
      );
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      setError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение подписки.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="rc-follow">
      <button
        className={`rc-button ${value ? "rc-follow-active" : ""}`}
        aria-label={`${value ? "Отключить" : "Включить"} уведомления: ${title}`}
        aria-pressed={value}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <NavigationIcon name="bell" className="h-5 w-5" />
        {!compact && (
          <span>
            {busy
              ? "Сохранение…"
              : value
                ? "Уведомления включены"
                : "Уведомлять"}
          </span>
        )}
      </button>
      {error && (
        <p className="rc-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
