import type { CosmeticItem } from "@/lib/cosmetics";
export default function ThemeSwatch({ item }: { item: CosmeticItem }) {
  return item.id === "theme-autumn-2026" ? (
    // eslint-disable-next-line @next/next/no-img-element -- Optimized local theme artwork.
    <img className="cx-theme-art" src="/backgrounds/autumn-2026-soft.webp" alt="Камин и золотая осень за окном" />
  ) : <div className={`cx-theme-art cx-theme-${item.id === "theme-obsidian" ? "obsidian" : item.id === "theme-mint" ? "mint" : "cosmos"}`} aria-hidden="true">{item.id === "theme-obsidian" ? "✦" : item.id === "theme-mint" ? "☘" : "☾"}</div>;
}
