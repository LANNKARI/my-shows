export const validDay = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
export function addDays(day: string, count: number) {
  const date = dayDate(day);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function todayInZone(zone = "UTC", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarRange(day: string, view: "week" | "month") {
  const date = dayDate(day);
  if (view === "month") date.setUTCDate(1);
  const from = addDays(
    date.toISOString().slice(0, 10),
    -((date.getUTCDay() + 6) % 7),
  );
  if (view === "week") return { from, to: addDays(from, 6) };
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  return { from, to: addDays(end, 6 - ((dayDate(end).getUTCDay() + 6) % 7)) };
}
export function shiftMonth(day: string, count: number) {
  const date = dayDate(day);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1),
  )
    .toISOString()
    .slice(0, 10);
}
export function formatDay(
  day: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ru-RU", {
    ...options,
    timeZone: "UTC",
  }).format(dayDate(day));
}
export function rangeDays(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 42; day = addDays(day, 1))
    days.push(day);
  return days;
}
