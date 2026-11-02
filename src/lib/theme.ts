export const THEME_STORAGE_KEY = "episyhub.theme.v1";
export const THEME_CHANGE_EVENT = "episyhub-theme-change";
export type Theme = "light" | "dark";

// Runs before paint. Storage can be unavailable in private or restricted browsers.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()`;
