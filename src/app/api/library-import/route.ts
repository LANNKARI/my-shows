import { NextRequest } from "next/server";
import {
  calendarUser,
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
import { previewImport, commitImport } from "@/lib/library-import";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const userId = await calendarUser(request, true);
    if (Number(request.headers.get("content-length")) > 2 * 1024 * 1024)
      throw new CalendarError(413, "Максимум 2 МБ");
    const reader = request.body?.getReader();
    if (!reader) throw new CalendarError(400, "Нет файла");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new CalendarError(413, "Максимум 2 МБ");
      }
      chunks.push(value);
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new CalendarError(400, "Некорректный JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new CalendarError(400, "Некорректный запрос");
    if (body.action === "preview")
      return privateJson(
        await previewImport(
          userId,
          body.backup,
          body.legacyStatus,
          body.mapping,
          body.newRun === true,
        ),
      );
    if (
      body.action === "commit" &&
      typeof body.jobId === "string" &&
      body.jobId.length < 100 &&
      Number.isSafeInteger(body.cursor) &&
      body.cursor >= 0
    )
      return privateJson(await commitImport(userId, body.jobId, body.cursor));
    throw new CalendarError(400, "Некорректное действие");
  } catch (e) {
    return calendarFailure(e);
  }
}
