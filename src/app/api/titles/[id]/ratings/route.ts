import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const titleId = Number(idStr);
  const { score, episodeId } = await req.json();

  if (!score || score < 1 || score > 10) {
    return NextResponse.json({ error: "score must be 1-10" }, { status: 400 });
  }

  const rating = await prisma.rating.create({
    data: { titleId, score: Number(score), episodeId: episodeId || null },
  });

  return NextResponse.json(rating, { status: 201 });
}