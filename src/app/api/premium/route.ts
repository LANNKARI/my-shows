import { NextRequest } from "next/server";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import { purchasePremium, premiumSnapshot } from "@/lib/premium";
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("sec-fetch-site") === "cross-site")
      throw new CalendarError(403, "Недопустимый источник запроса");
    const id = await calendarUser(req, true);
    const result = await purchasePremium(
      id,
      await req.json().catch(() => null),
    );
    return privateJson({ ...result, ...(await premiumSnapshot(id)) });
  } catch (e) {
    return calendarFailure(e);
  }
}
