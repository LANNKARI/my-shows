import { useId } from "react";
import type { CosmeticItem } from "@/lib/cosmetics";

const previews: Record<string, { tone: string; background?: string; colors: string[] }> = {
  "theme-obsidian": { tone: "obsidian", background: "obsidian-gold-preview.webp", colors: ["#d9ba73", "#8d784b", "#eee5d0"] },
  "theme-cosmos": { tone: "cosmos", background: "cosmos-nebula.webp", colors: ["#bda2ff", "#7760bb", "#ede5ff"] },
  "theme-mint": { tone: "mint", background: "mint-nebula.webp", colors: ["#367c53", "#a8cfb1", "#f2f8ed"] },
  "theme-autumn-2026": { tone: "autumn", background: "autumn-2026-soft.webp", colors: ["#c16b30", "#dfb566", "#fff0d5"] },
};

export default function ThemeSwatch({ item }: { item: CosmeticItem }) {
  const id = useId().replace(/:/g, "");
  const preview = previews[item.id] || previews["theme-cosmos"];
  return (
    <div className="cx-theme-art cx-theme-miniature" data-preview-theme={preview.tone}>
      <svg viewBox="0 0 400 240" role="img" aria-label={`Превью темы «${item.name}»: фон, карточки и цвета интерфейса`}>
        <defs>
          <linearGradient id={`${id}-sky`} x2="0" y2="1">
            <stop stopColor={preview.colors[1]} />
            <stop offset="1" stopColor={preview.colors[0]} />
          </linearGradient>
          <clipPath id={`${id}-window`}><rect x="28" y="29" width="344" height="185" rx="13" /></clipPath>
        </defs>
        <circle className="cx-mini-halo" cx="320" cy="45" r="105" />
        <circle className="cx-mini-halo" cx="55" cy="225" r="74" />
        <g className="cx-mini-window">
          <rect className="cx-mini-panel" x="28" y="29" width="344" height="185" rx="13" />
          <g clipPath={`url(#${id}-window)`}>
            {preview.background && <image href={`/backgrounds/${preview.background}`} x="28" y="29" width="344" height="185" preserveAspectRatio="xMidYMid slice" opacity=".45" />}
            <rect className="cx-mini-header" x="28" y="29" width="344" height="30" />
            <path className="cx-mini-accent" d="M44 38L44 50L55 44Z" />
            <ellipse className="cx-mini-orbit" cx="49" cy="44" rx="11" ry="4" transform="rotate(-24 49 44)" />
            <text className="cx-mini-text" x="65" y="47" fontSize="10" fontWeight="750">EpisyHub</text>
            <rect className="cx-mini-muted" x="153" y="41" width="23" height="4" rx="2" />
            <rect className="cx-mini-muted" x="186" y="41" width="32" height="4" rx="2" />
            <rect className="cx-mini-search" x="258" y="38" width="70" height="12" rx="6" />
            <circle className="cx-mini-accent" cx="348" cy="44" r="6" />
            <rect className="cx-mini-hero" x="42" y="72" width="316" height="64" rx="9" />
            <text className="cx-mini-text" x="55" y="92" fontSize="12" fontWeight="750">Ещё одна история</text>
            <rect className="cx-mini-muted" x="55" y="101" width="111" height="3" rx="1.5" />
            <rect className="cx-mini-accent" x="55" y="113" width="63" height="12" rx="6" />
            <circle fill={`url(#${id}-sky)`} cx="306" cy="102" r="23" />
            <ellipse className="cx-mini-orbit" cx="306" cy="102" rx="36" ry="10" transform="rotate(-25 306 102)" />
            <path className="cx-mini-highlight" d="M301 91V113L318 102Z" />
            {[0, 1, 2, 3].map((index) => <g key={index} transform={`translate(${42 + index * 81} 148)`}>
              <rect className="cx-mini-tile" width="73" height="55" rx="6" />
              <rect fill={`url(#${id}-sky)`} width="73" height="36" rx="6" opacity={1 - index * .12} />
              <circle className="cx-mini-highlight" cx={49 - index * 7} cy="11" r="6" opacity=".7" />
              <path className="cx-mini-mountain" d="M0 32L21 15L37 27L51 20L73 34V36H0Z" />
              <rect className="cx-mini-text-fill" x="7" y="42" width="43" height="3" rx="1.5" />
              <rect className="cx-mini-muted" x="7" y="48" width="25" height="2" rx="1" />
            </g>)}
          </g>
          <rect className="cx-mini-outline" x="28" y="29" width="344" height="185" rx="13" />
        </g>
      </svg>
      <span className="cx-theme-palette" aria-hidden="true">{preview.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>
    </div>
  );
}
