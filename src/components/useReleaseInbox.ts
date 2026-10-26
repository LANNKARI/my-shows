"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { browserZone, type ReleaseInbox } from "@/lib/release-types";
export default function useReleaseInbox(mode: "all" | "unread" = "all") {
  const instanceId = useId();
  const [data, setData] = useState<ReleaseInbox | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null),
    lock = useRef(false),
    snapshot = useRef<ReleaseInbox | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    await Promise.resolve();
    if (abort.signal.aborted) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/notifications?mode=${mode}&timeZone=${encodeURIComponent(browserZone())}`,
        { signal: abort.signal, cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось загрузить уведомления");
      if (!abort.signal.aborted) {
        snapshot.current = result;
        setData(result);
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error && error.name === "Error"
            ? error.message
            : "Не удалось загрузить уведомления.",
        );
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    const update = (event?: Event) => {
      if (
        (event as CustomEvent<{ source?: string }> | undefined)?.detail
          ?.source === instanceId
      )
        return;
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("notifications-updated", update);
    document.addEventListener("visibilitychange", update);
    const timer = setInterval(() => update(), 60000);
    return () => {
      window.removeEventListener("notifications-updated", update);
      document.removeEventListener("visibilitychange", update);
      clearInterval(timer);
    };
  }, [refresh, instanceId]);
  async function read(ids?: number[]) {
    if (lock.current || !snapshot.current) return false;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/notifications?timeZone=${encodeURIComponent(browserZone())}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            ids ? { ids } : { all: true, throughId: snapshot.current.latestId },
          ),
          signal: AbortSignal.timeout(15000),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось отметить прочитанным");
      await refresh();
      window.dispatchEvent(
        new CustomEvent("notifications-updated", {
          detail: { source: instanceId },
        }),
      );
      return true;
    } catch (error) {
      setError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение. Обновите уведомления.",
      );
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  async function more() {
    if (lock.current || !snapshot.current?.nextCursor) return;
    lock.current = true;
    setLoading(true);
    setError("");
    const previous = snapshot.current;
    try {
      const response = await fetch(
        `/api/notifications?mode=${mode}&timeZone=${encodeURIComponent(browserZone())}&cursor=${previous.nextCursor}`,
        { signal: AbortSignal.timeout(15000) },
      );
      const result: ReleaseInbox & { error?: string } = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось загрузить уведомления");
      const merged = {
        ...result,
        items: [
          ...previous.items,
          ...result.items.filter(
            (item) => !previous.items.some((old) => old.id === item.id),
          ),
        ],
      };
      snapshot.current = merged;
      setData(merged);
    } catch {
      setError("Не удалось загрузить следующие уведомления.");
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }
  return { data, loading, error, saving, refresh, read, more };
}
