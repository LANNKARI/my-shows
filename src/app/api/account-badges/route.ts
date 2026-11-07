import { prisma } from "@/lib/prisma";
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
    const badges = await publicAccountBadges(ids);
    if (req.nextUrl.searchParams.get("appearance") !== "1")
      return privateJson(badges);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, avatarFrame: true },
    });
    return privateJson({
      badges,
      frames: Object.fromEntries(
        users.map((user) => [user.id, user.avatarFrame]),
      ),
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
