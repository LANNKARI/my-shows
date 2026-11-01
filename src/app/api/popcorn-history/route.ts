import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calendarUser,
  calendarFailure,
  CalendarError,
  privateJson,
} from "@/lib/calendar-server";
export async function GET(request: NextRequest) {
  try {
    const userId = await calendarUser(request);
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (cursor && !/^\d{4}-\d{2}-\d{2}:[a-f0-9]{32}$/.test(cursor))
      throw new CalendarError(400, "Некорректная страница");
    const cursorDay = cursor?.slice(0, 10) ?? "9999-12-31";
    const cursorId = cursor?.slice(11) ?? "ffffffffffffffffffffffffffffffff";
    // Aggregate before pagination: even a large day of game rewards is one row.
    // Preserve categories and debit/credit direction so purchases never cancel awards.
    const rows = await prisma.$queryRaw<
      {
        id: string;
        day: string;
        reason: string;
        amount: bigint;
        count: number;
      }[]
    >`
      WITH source AS (
        SELECT "day", "category", "amount",
          CASE WHEN "category" = 'game' AND "amount" >= 0 THEN 'За мини-игры' ELSE "reason" END AS reason
        FROM "PopcornEntry"
        WHERE "userId" = ${userId} AND "category" NOT IN ('legacy', 'game-event')
      ), grouped AS (
        SELECT "day"::text AS day, reason,
          md5(jsonb_build_array("day"::text, "category", reason, CASE WHEN "amount" < 0 THEN -1 ELSE 1 END)::text) AS id,
          SUM("amount") AS amount, COUNT(*)::integer AS count
        FROM source
        GROUP BY "day", "category", reason, CASE WHEN "amount" < 0 THEN -1 ELSE 1 END
      )
      SELECT * FROM grouped
      WHERE (day, id) < (${cursorDay}, ${cursorId})
      ORDER BY day DESC, id DESC LIMIT 21
    `;
    return privateJson({
      items: rows.slice(0, 20).map((row) => ({
        id: `${row.day}:${row.id}`,
        reason: row.reason,
        amount: Number(row.amount),
        count: row.count,
        createdAt: `${row.day}T00:00:00.000Z`,
      })),
      nextCursor: rows.length > 20 ? `${rows[19].day}:${rows[19].id}` : null,
    });
  } catch (e) {
    return calendarFailure(e);
  }
}
