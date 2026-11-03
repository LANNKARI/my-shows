"use client";

import { useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { applyTheme, currentTheme, themeItemId, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";

function getTheme(): Theme {
  return currentTheme();
}
function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}
const serverSnapshot = (): Theme => "dark";

export default function ThemeToggle() {
  const current = useSyncExternalStore(subscribe, getTheme, serverSnapshot);
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function select(theme: Theme) {
    if (saving) return;
    const previous = currentTheme();
    setError("");
    applyTheme(theme);
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const response = await fetch("/api/cosmetics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "equip", itemId: themeItemId(theme) }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Не удалось сохранить тему. Попробуйте ещё раз.");
    } catch { applyTheme(previous); setError("Не удалось сохранить тему. Попробуйте ещё раз."); }
    finally { setSaving(false); }
  }
  return (
    <div>
    <div className="theme-toggle" role="group" aria-label="Тема оформления">
      <button type="button" disabled={saving} title="Космос — тема по умолчанию" aria-label="Тёмная тема — Космос" aria-pressed={current === "dark"} onClick={() => select("dark")}>
        <span aria-hidden="true">☾</span><span className="theme-toggle-label">Космос</span>
      </button>
      <button type="button" disabled={saving} title="Мята — светлая тема" aria-label="Светлая тема — Мята" aria-pressed={current === "light"} onClick={() => select("light")}>
        <span aria-hidden="true">☀</span><span className="theme-toggle-label">Мята</span>
      </button>
      {current === "autumn-2026" && <button type="button" disabled={saving} aria-label="Светлая тема — Осень 2026" aria-pressed="true"><span aria-hidden="true">🍂</span><span className="theme-toggle-label">Осень 2026</span></button>}
    </div>
    {error && <p role="alert" className="text-xs">{error}</p>}
    </div>
  );
}
