"use client";

import { useSyncExternalStore } from "react";
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
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
  function select(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep working for this tab. */ }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
  return (
    <div className="theme-toggle" role="group" aria-label="Тема оформления">
      <button type="button" title="Космос — тема по умолчанию" aria-label="Тёмная тема — Космос" aria-pressed={current === "dark"} onClick={() => select("dark")}>
        <span aria-hidden="true">☾</span><span className="theme-toggle-label">Космос</span>
      </button>
      <button type="button" title="Мята — светлая тема" aria-label="Светлая тема — Мята" aria-pressed={current === "light"} onClick={() => select("light")}>
        <span aria-hidden="true">☀</span><span className="theme-toggle-label">Мята</span>
      </button>
    </div>
  );
}
