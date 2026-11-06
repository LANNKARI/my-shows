import { NextRequest } from "next/server";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import { adminSnapshot, adminMutation } from "@/lib/admin-store";
export async function GET(req: NextRequest) {
  try {
    const id = await calendarUser(req),
      q = req.nextUrl.searchParams;
    return privateJson(
      await adminSnapshot(
        id,
        q.get("tab") || "users",
        q.get("q") || "",
        Number(q.get("offset") || 0),
      ),
    );
  } catch (e) {
    return calendarFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("sec-fetch-site") === "cross-site")
      throw new CalendarError(403, "Недопустимый источник запроса");
    const id = await calendarUser(req, true);
    return privateJson(
      await adminMutation(id, await req.json().catch(() => null)),
    );
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      return privateJsonError("Такое название или промокод уже существует");
    return calendarFailure(e);
  }
}
function privateJsonError(error: string) {
  return Response.json(
    { error },
    { status: 409, headers: { "Cache-Control": "private, no-store" } },
  );
}
