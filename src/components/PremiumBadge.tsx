/** One optimized local asset shared by member names and subscription controls. */
export default function PremiumBadge({
  size = 22,
  decorative = false,
}: {
  size?: number;
  decorative?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Small pre-optimized local badge.
    <img
      className="premium-badge-icon"
      src="/branding/episyhub-premium.webp"
      width={size}
      height={size}
      alt={decorative ? "" : "EpisyHub Premium"}
      title={decorative ? undefined : "EpisyHub Premium"}
      draggable={false}
    />
  );
}
