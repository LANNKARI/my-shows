"use client";

export default function WatchSiteChip({ site }: { site: string }) {
  const trimmed = site.trim();

  const looksLikeDomain = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed);
  const url = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : looksLikeDomain
    ? `https://${trimmed}`
    : null;

  function label(s: string): string {
    try {
      const u = new URL(s);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return s;
    }
  }

  const baseCls =
    "badge badge-dark bg-white/5 border border-white/5 px-3 py-1.5";

  if (!url) {
    return (
      <span className={`${baseCls} text-neutral-300`}>🌐 {trimmed}</span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`${baseCls} text-neutral-300 hover:text-red-400 hover:bg-white/10 hover:border-white/20 transition-colors cursor-pointer`}
    >
      🌐 {label(url)}
      <span className="text-[10px] opacity-70 ml-1">↗</span>
    </a>
  );
}