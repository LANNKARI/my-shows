"use client";
import { useAccountBadges } from "./AccountAccess";
/* eslint-disable @next/next/no-img-element -- Preserves existing user-uploaded covers. */
import { profileStyleId, STANDARD_PROFILE } from "@/lib/cosmetics";
import "./cosmetics.css";
export default function CosmeticCover({
  styleId,
  bannerUrl,
  userId,
}: {
  styleId?: string | null;
  bannerUrl?: string | null;
  userId?: string;
}) {
  const badges = useAccountBadges(userId);
  const allowed = !userId || badges?.some((b) => b.roleId === "premium");
  const selected = profileStyleId(styleId);
  return (
    <div
      className="cosmetic-cover"
      data-profile-style={selected}
      aria-hidden="true"
    >
      {selected === STANDARD_PROFILE && bannerUrl && allowed && (
        <img src={bannerUrl} alt="" />
      )}
      <div className="cosmetic-cover-shade" />
    </div>
  );
}
