/* eslint-disable @next/next/no-img-element -- Reuses existing uploaded or remote profile photos. */
import { frameId } from "@/lib/cosmetics";
import "./cosmetics.css";
export default function CosmeticAvatar({
  name,
  src,
  frame,
  size = 48,
}: {
  name: string;
  src?: string | null;
  frame?: string | null;
  size?: number;
}) {
  return (
    <span
      className="cosmetic-avatar"
      data-frame={frameId(frame)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.35) }}
      role="img"
      aria-label={`Аватар: ${name}`}
    >
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
