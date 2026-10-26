import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { validDay, validTimeZone, dayDate } from "@/lib/calendar-dates";
export class CalendarError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function calendarUser(request: NextRequest, write = false) {
  if (write) {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    url.host = request.headers.get("host") || url.host;
    if (origin && origin !== url.origin)
      throw new CalendarError(403, "Недопустимый источник запроса");
  }
  const userId = await getCurrentUserId();
  if (!userId) throw new CalendarError(401, "Войдите в аккаунт");
  return userId;
}
export function queryRange(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from"),
    to = request.nextUrl.searchParams.get("to");
  if (
    !validDay(from) ||
    !validDay(to) ||
    from > to ||
    dayDate(to).getTime() - dayDate(from).getTime() > 41 * 86400000 ||
    from < "1999-12-01" ||
    to > "2101-01-31"
  )
    throw new CalendarError(400, "Некорректный диапазон дат");
  return { from, to };
}
export function timeZone(value: unknown) {
  if (value === null || value === undefined) return "UTC";
  if (!validTimeZone(value))
    throw new CalendarError(400, "Некорректный часовой пояс");
  return value;
}
export function calendarFailure(error: unknown) {
  if (error instanceof CalendarError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("Calendar request failed", error);
  return NextResponse.json(
    { error: "Сервис временно недоступен. Попробуйте ещё раз." },
    { status: 503 },
  );
}
export const privateJson = (data: unknown) =>
  NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
