import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const titleId = Number(idStr);

  // Проверяем владение
  const owned = await prisma.title.findFirst({
    where: { id: titleId, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { score, episodeId } = await req.json();
  if (!score || score < 1 || score > 10) {
    return NextResponse.json({ error: "score must be 1-10" }, { status: 400 });
  }

  const rating = await prisma.rating.create({
    data: { titleId, score: Number(score), episodeId: episodeId || null },
  });

  return NextResponse.json(rating, { status: 201 });
}