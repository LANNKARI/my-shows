"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const changeEvent = "episyhub-theme-change";
function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    onChange();
  };
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
const serverSnapshot = (): Theme => "light";

export default function ThemeToggle() {
  const current = useSyncExternalStore(subscribe, getTheme, serverSnapshot);
  function select(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep working for this tab. */ }
    window.dispatchEvent(new Event(changeEvent));
  }
  return (
    <div className="theme-toggle" role="group" aria-label="Тема оформления">
      <button type="button" aria-label="Светлая тема — Мята" aria-pressed={current === "light"} onClick={() => select("light")}>
        <span aria-hidden="true">☀</span><span className="theme-toggle-label">Мята</span>
      </button>
      <button type="button" aria-label="Тёмная тема — Космос" aria-pressed={current === "dark"} onClick={() => select("dark")}>
        <span aria-hidden="true">☾</span><span className="theme-toggle-label">Космос</span>
      </button>
    </div>
  );
}
