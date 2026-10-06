"use client";

import Link from "next/link";

export type BadgeData = {
  id: string;
  name: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  description: string;
};

const TIER_STYLES: Record<BadgeData["tier"], string> = {
  bronze: "bg-gradient-to-br from-amber-700 to-amber-900 border-amber-600/40",
  silver: "bg-gradient-to-br from-neutral-400 to-neutral-600 border-neutral-300/40",
  gold: "bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-300/40",
  legendary: "bg-gradient-to-br from-purple-500 to-pink-600 border-purple-300/40",
};

export default function AchievementBadges({
  badges,
  max = 3,
  username,
  size = "md",
}: {
  badges: BadgeData[];
  max?: number;
  username?: string;
  size?: "sm" | "md";
}) {
  if (!badges || badges.length === 0) return null;

  const visible = badges.slice(0, max);
  const more = badges.length - visible.length;

  const sizeCls =
    size === "sm"
      ? "w-5 h-5 text-[10px]"
      : "w-7 h-7 text-sm";

  const content = (
    <div className="inline-flex items-center gap-1">
      {visible.map((b) => (
        <span
          key={b.id}
          title={`${b.name} — ${b.description}`}
          className={`${sizeCls} ${TIER_STYLES[b.tier]} rounded-full flex items-center justify-center border shadow-sm cursor-help`}
        >
          {b.icon}
        </span>
      ))}
      {more > 0 && (
        <span
          className={`${sizeCls} bg-neutral-800 border border-white/10 rounded-full flex items-center justify-center text-neutral-400 font-semibold cursor-help`}
          title={`Ещё ${more} достижений`}
        >
          +{more}
        </span>
      )}
    </div>
  );

  if (username) {
    return (
      <Link
        href={`/u/${username}/achievements`}
        className="hover:opacity-80 transition"
      >
        {content}
      </Link>
    );
  }

  return content;
}