"use client";
import { useRef, useState } from "react";
import { browserZone, type ReleasePreferences } from "@/lib/release-types";
export default function ReleaseSettings({
  initial,
}: {
  initial: ReleasePreferences;
}) {
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function save(field: "releaseNotificationsEnabled" | "notifyNewShows") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/release-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: !value[field],
          timeZone: browserZone(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось сохранить настройки");
      setValue(data);
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      setError(
        error instanceof Error && error.name === "Error"
          ? error.message
          : "Не удалось подтвердить сохранение настроек.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="rc-panel rc-settings" id="release-settings">
      <h2>Настройки уведомлений</h2>
      {(
        [
          [
            "releaseNotificationsEnabled",
            "Новые серии",
            "Только для сериалов с включённым колокольчиком. История уведомлений сохраняется.",
          ],
          [
            "notifyNewShows",
            "Включать для новых сериалов",
            "Уже выбранные сериалы не изменятся.",
          ],
        ] as const
      ).map(([field, label, help]) => (
        <div className="rc-setting" key={field}>
          <div>
            <strong>{label}</strong>
            <p className="rc-muted">{help}</p>
          </div>
          <button
            className="rc-switch"
            role="switch"
            aria-label={label}
            aria-checked={value[field]}
            disabled={busy}
            onClick={() => void save(field)}
          >
            <span />
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="rc-error">
          {error}
        </p>
      )}
    </section>
  );
}
