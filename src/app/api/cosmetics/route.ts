import { NextRequest } from "next/server";
import {
  calendarUser as authenticatedUser,
  calendarFailure,
  privateJson,
} from "@/lib/calendar-server";
import {
  CosmeticError,
  cosmeticsSnapshot,
  mutateCosmetics,
} from "@/lib/cosmetics-store";
export async function GET(request: NextRequest) {
  try {
    return privateJson(
      await cosmeticsSnapshot(await authenticatedUser(request)),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticatedUser(request, true);
    return privateJson(
      await mutateCosmetics(userId, await request.json().catch(() => null)),
    );
  } catch (error) {
    return failure(error);
  }
}
function failure(error: unknown) {
  return error instanceof CosmeticError
    ? Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      )
    : calendarFailure(error);
}
