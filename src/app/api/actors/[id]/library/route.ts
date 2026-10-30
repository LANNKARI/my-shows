import { actorLibrary } from "@/lib/actor-library";
import { actorId, ActorError, loadActor } from "@/lib/actors";
import {
  calendarUser,
  calendarFailure,
  privateJson,
  CalendarError,
} from "@/lib/calendar-server";
import { NextRequest } from "next/server";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await calendarUser(request);
    const actor = await loadActor(actorId((await params).id));
    return privateJson({ keys: await actorLibrary(userId, actor.credits) });
  } catch (error) {
    return calendarFailure(
      error instanceof ActorError
        ? new CalendarError(error.status, error.message)
        : error,
    );
  }
}
