"use client";

import { useEffect } from "react";
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from "@/lib/theme";

export default function ThemeSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      document.documentElement.dataset.theme = event.newValue === "light" ? "light" : "dark";
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
