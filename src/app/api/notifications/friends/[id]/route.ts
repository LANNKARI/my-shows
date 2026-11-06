import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await calendarUser(request, true),
      id = Number((await params).id),
      body = await request.json().catch(() => null);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => k !== "action") ||
      !["accept", "decline"].includes(body.action)
    )
      throw new CalendarError(400, "Некорректная заявка");
    const result = await prisma.$transaction(async (tx) => {
      const where = { id, addresseeId: userId, status: "pending" };
      const changed =
        body.action === "accept"
          ? await tx.friendship.updateMany({
              where,
              data: { status: "accepted", notificationReadAt: new Date() },
            })
          : await tx.friendship.deleteMany({ where });
      if (!changed.count)
        throw new CalendarError(409, "Заявка уже обработана или недоступна");
      return {
        success: true,
        status: body.action === "accept" ? "friends" : "declined",
      };
    });
    return privateJson(result);
  } catch (e) {
    return calendarFailure(e);
  }
}
