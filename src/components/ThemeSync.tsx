"use client";
import { useAccount } from "./AccountAccess";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { applyTheme, currentTheme, themeForItem, validTheme, THEME_STORAGE_KEY } from "@/lib/theme";

export default function ThemeSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const {account}=useAccount();
  const previousUser = useRef<string | undefined>(undefined);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      applyTheme(validTheme(event.newValue) ? event.newValue : "dark", false);
      delete document.documentElement.dataset.themePreview;
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (status === "loading") return;
    if (!userId) {
      if (previousUser.current && ["autumn-2026","obsidian"].includes(currentTheme())) applyTheme("dark");
      previousUser.current = undefined;
      return;
    }
    previousUser.current = userId;
    const abort = new AbortController();
    const initial = currentTheme();
    fetch("/api/site-theme", { cache: "no-store", signal: abort.signal })
      .then(async response => response.ok ? response.json() : null)
      .then(result => {
        if (!result || abort.signal.aborted || document.documentElement.dataset.themePreview || currentTheme() !== initial) return;
        const theme = themeForItem(result.theme);
        if (theme) applyTheme(theme);
        else if (currentTheme() === "obsidian" || result.ownsAutumn === false && currentTheme() === "autumn-2026") applyTheme("dark");
      }).catch(() => { /* Keep the locally selected theme when offline. */ });
    return () => abort.abort();
  }, [userId, status, account?.premium.active]);
  return null;
}
