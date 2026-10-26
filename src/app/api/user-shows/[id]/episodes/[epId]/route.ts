import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, safeJson } from "@/lib/current-user";
import {
  saveProgressByRecord,
  mutationErrorResponse,
} from "@/lib/library-mutations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epId: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id, epId } = await params;
    return NextResponse.json(
      safeJson(
        await saveProgressByRecord(
          userId,
          Number(id),
          Number(epId),
          await request.json().catch(() => null),
        ),
      ),
    );
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
