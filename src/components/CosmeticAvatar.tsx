"use client";
import { useAccountBadges } from "./AccountAccess";
/* eslint-disable @next/next/no-img-element -- Reuses existing uploaded or remote profile photos. */
import { frameId } from "@/lib/cosmetics";
import "./cosmetics.css";
export default function CosmeticAvatar({
  name,
  src,
  frame,
  size = 48,
  userId,
}: {
  name: string;
  userId?: string;
  src?: string | null;
  frame?: string | null;
  size?: number;
}) {
  const badges = useAccountBadges(userId);
  const allowedFrame =
    userId &&
    ((frame === "frame-premium-orbit" &&
      !badges?.some((b) => b.roleId === "premium")) ||
      (frame === "frame-pioneer" &&
        !badges?.some((b) => b.roleId === "pioneer")))
      ? "frame-standard"
      : frame;
  const selected = frameId(allowedFrame);
  const animated =
    selected === "frame-premium-orbit" || selected === "frame-gold-light";
  return (
    <span
      className="cosmetic-avatar"
      data-frame={selected}
      data-small={size < 40}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.35) }}
      role="img"
      aria-label={`Аватар: ${name}`}
    >
      {animated && (
        <svg
          className="cosmetic-frame-motion"
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            className="cosmetic-frame-trail"
            cx="50"
            cy="50"
            r="46"
            pathLength="100"
            strokeDasharray={
              selected === "frame-premium-orbit" ? "10 90" : "18 82"
            }
            transform="rotate(-90 50 50)"
          />
          <circle
            className="cosmetic-frame-spark"
            cx="50"
            cy="4"
            r={selected === "frame-premium-orbit" ? 2.6 : 1.7}
          />
          {selected === "frame-premium-orbit" && (
            <circle
              className="cosmetic-frame-secondary"
              cx="50"
              cy="96"
              r="1.5"
            />
          )}
        </svg>
      )}
      <span className="cosmetic-avatar-face">
        {src ? (
          <img src={src} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}
