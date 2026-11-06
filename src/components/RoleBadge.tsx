import PremiumBadge from "./PremiumBadge";
const roleArtwork: Record<string, string> = {
  owner: "/branding/roles/owner.webp",
  moderator: "/branding/roles/moderator.webp",
  curator: "/branding/roles/curator.webp",
  tester: "/branding/roles/tester.webp",
  pioneer: "/branding/roles/pioneer.webp",
};
export function hasRoleArtwork(roleId?: string) {
  return !!roleId && Object.hasOwn(roleArtwork, roleId);
}
/** Stable role IDs select artwork; custom roles keep their configured symbol. */
export default function RoleBadge({
  roleId,
  name,
  icon = "✦",
  color,
  size = 22,
  decorative = false,
}: {
  roleId?: string;
  name: string;
  icon?: string;
  color?: string;
  size?: number;
  decorative?: boolean;
}) {
  if (roleId === "premium" || name === "Premium")
    return <PremiumBadge size={size} decorative={decorative} />;
  const src = hasRoleArtwork(roleId) ? roleArtwork[roleId!] : undefined;
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Pre-optimized small local artwork.
      <img
        className="role-badge-icon"
        src={src}
        width={size}
        height={size}
        alt={decorative ? "" : name}
        title={decorative ? undefined : name}
        draggable={false}
      />
    );
  return (
    <span
      className="account-badge"
      title={decorative ? undefined : name}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      style={{ color }}
    >
      {icon}
    </span>
  );
}
