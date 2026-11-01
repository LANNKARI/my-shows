/** A two-week episode window handles weekly and fortnightly release schedules. */
export const AIRING_WINDOW_DAYS = 14;
export function airingWindow(now = new Date()) {
  const day = new Date(now.toISOString().slice(0, 10));
  return {
    today: day.toISOString().slice(0, 10),
    from: new Date(day.getTime() - AIRING_WINDOW_DAYS * 86400000)
      .toISOString()
      .slice(0, 10),
    to: new Date(day.getTime() + AIRING_WINDOW_DAYS * 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
type TvSchedule = {
  status?: string;
  in_production?: boolean;
  first_air_date?: string;
  last_episode_to_air?: { air_date?: string } | null;
  next_episode_to_air?: { air_date?: string } | null;
};
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function isCurrentlyAiring(
  details: TvSchedule | null,
  now = new Date(),
) {
  if (
    !details ||
    details.in_production !== true ||
    details.status !== "Returning Series"
  )
    return false;
  const { today, from, to } = airingWindow(now);
  if (!validDate(details.first_air_date) || details.first_air_date > today)
    return false;
  const last = details.last_episode_to_air?.air_date,
    next = details.next_episode_to_air?.air_date;
  return (
    (validDate(last) && last >= from && last <= today) ||
    (validDate(next) && next >= today && next <= to)
  );
}
