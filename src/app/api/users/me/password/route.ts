import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  CalendarError,
  calendarFailure,
} from "@/lib/calendar-server";
import { passwordAttempt } from "@/lib/password-limit";

const reply = (
  body: object,
  status = 200,
  headers: Record<string, string> = {},
) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ error: "Некорректный запрос" }, 400);
    const fields = body as Record<string, unknown>;
    const { currentPassword, newPassword } = fields;
    if (
      Object.keys(fields).some(
        (key) => !["currentPassword", "newPassword"].includes(key),
      ) ||
      typeof currentPassword !== "string" ||
      !currentPassword ||
      currentPassword.length > 1024 ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return reply(
        {
          error:
            "Введите текущий пароль. Новый пароль: от 8 символов, не более 72 байт UTF-8.",
        },
        400,
      );
    }
    const retryAfter = passwordAttempt(userId);
    if (retryAfter)
      return reply({ error: "Слишком много попыток. Попробуйте позже." }, 429, {
        "Retry-After": String(retryAfter),
      });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    )
      return reply({ error: "Текущий пароль неверен" }, 400);
    if (await bcrypt.compare(newPassword, user.passwordHash))
      return reply(
        { error: "Новый пароль должен отличаться от текущего" },
        400,
      );
    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Never overwrite another password change that completed during verification.
    const result = await prisma.user.updateMany({
      where: { id: userId, passwordHash: user.passwordHash },
      data: { passwordHash },
    });
    if (!result.count)
      return reply(
        { error: "Пароль уже изменён. Введите актуальный текущий пароль." },
        409,
      );
    return reply({ success: true });
  } catch (error) {
    if (error instanceof CalendarError)
      return reply({ error: error.message }, error.status);
    return calendarFailure(error);
  }
}
