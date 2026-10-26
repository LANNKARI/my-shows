/* eslint-disable @next/next/no-img-element -- Preserves existing user-uploaded covers. */
import { profileStyleId, STANDARD_PROFILE } from "@/lib/cosmetics";
import "./cosmetics.css";
export default function CosmeticCover({
  styleId,
  bannerUrl,
}: {
  styleId?: string | null;
  bannerUrl?: string | null;
}) {
  const selected = profileStyleId(styleId);
  return (
    <div
      className="cosmetic-cover"
      data-profile-style={selected}
      aria-hidden="true"
    >
      {selected === STANDARD_PROFILE && bannerUrl && (
        <img src={bannerUrl} alt="" />
      )}
      <div className="cosmetic-cover-shade" />
    </div>
  );
}
