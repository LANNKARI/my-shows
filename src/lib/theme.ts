export const THEME_STORAGE_KEY = "episyhub.theme.v1";
export const THEME_CHANGE_EVENT = "episyhub-theme-change";
export type Theme = "light" | "dark" | "autumn-2026" | "obsidian";
export function validTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "autumn-2026" || value === "obsidian";
}
export function themeForItem(id: unknown): Theme | null {
  return id === "theme-obsidian" ? "obsidian" : id === "theme-autumn-2026" ? "autumn-2026" : id === "theme-mint" ? "light" : id === "theme-cosmos" ? "dark" : null;
}
export function themeItemId(theme: Theme) {
  return theme === "obsidian" ? "theme-obsidian" : theme === "autumn-2026" ? "theme-autumn-2026" : theme === "light" ? "theme-mint" : "theme-cosmos";
}
export function currentTheme(): Theme {
  return document.documentElement.dataset.siteTheme === "obsidian" ? "obsidian" : document.documentElement.dataset.siteTheme === "autumn-2026" ? "autumn-2026" : document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme === "light" || theme === "autumn-2026" ? "light" : "dark";
  document.documentElement.dataset.siteTheme = theme;
  if (persist) {
    delete document.documentElement.dataset.themePreview;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Theme still works in this tab. */ }
  } else document.documentElement.dataset.themePreview = "true";
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
// Keep legacy light/dark preferences and apply purchased themes before first paint.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'||t==='autumn-2026'?'light':'dark';document.documentElement.dataset.siteTheme=t==='obsidian'?'obsidian':t==='autumn-2026'?'autumn-2026':t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()`;
