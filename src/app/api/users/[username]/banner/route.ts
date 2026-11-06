import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  CalendarError,
  calendarFailure,
  privateJson,
} from "@/lib/calendar-server";
import { premiumActive } from "@/lib/premium";
import { saveProfileBanner } from "@/lib/profile-banner";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const userId = await calendarUser(request, true),
      { username } = await params;
    const owner = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (owner?.id !== userId)
      throw new CalendarError(403, "Нет прав на изменение");
    if (!(await premiumActive(userId)))
      throw new CalendarError(403, "Своя шапка доступна с активным Premium");
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await request.json().catch(() => null);
      if (!body || Object.keys(body).length !== 1 || body.action !== "reset")
        throw new CalendarError(400, "Некорректный запрос");
      return privateJson(await saveProfileBanner(userId, username, null));
    }
    if (!type.includes("multipart/form-data"))
      throw new CalendarError(400, "Выберите изображение");
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      ![...form.keys()].every((k) => k === "file") ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new CalendarError(400, "Разрешены JPEG, PNG и WebP");
    if (file.size > 10 * 1024 * 1024)
      throw new CalendarError(413, "Максимальный размер — 10 МБ");
    return privateJson(
      await saveProfileBanner(
        userId,
        username,
        Buffer.from(await file.arrayBuffer()),
      ),
    );
  } catch (e) {
    return calendarFailure(e);
  }
}
