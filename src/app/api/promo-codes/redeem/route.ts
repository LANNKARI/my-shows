import { NextRequest } from "next/server";
import { calendarUser, calendarFailure, privateJson } from "@/lib/calendar-server";
import { redeemPromo } from "@/lib/promo-codes";
export async function POST(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true);
    return privateJson(await redeemPromo(userId, await request.json().catch(() => null)));
  } catch (error) { return calendarFailure(error); }
}
