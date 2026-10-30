import { NextResponse } from "next/server";
import { actorId, ActorError, loadActor } from "@/lib/actors";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await loadActor(actorId((await params).id));
    return NextResponse.json(actor, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ActorError
            ? error.message
            : "Не удалось загрузить актёра. Попробуйте ещё раз.",
      },
      {
        status: error instanceof ActorError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
