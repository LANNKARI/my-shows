import { NextRequest } from "next/server";
import { publicAccountBadges } from "@/lib/account-access";
import {
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
export async function GET(req: NextRequest) {
  try {
    const ids = [
      ...new Set(
        (req.nextUrl.searchParams.get("ids") || "").split(",").filter(Boolean),
      ),
    ];
    if (ids.length > 50 || ids.some((id) => !/^[-\w]{1,80}$/.test(id)))
      throw new CalendarError(400, "Некорректные пользователи");
    return privateJson(await publicAccountBadges(ids));
  } catch (e) {
    return calendarFailure(e);
  }
}
