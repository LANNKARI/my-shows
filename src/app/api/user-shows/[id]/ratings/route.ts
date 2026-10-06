import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// GET — оценки этого UserShow
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const userShowId = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id: userShowId, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ratings = await prisma.rating.findMany({
    where: { userShowId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ratings);
}

// POST — поставить/обновить оценку
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const userShowId = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id: userShowId, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const { score, episodeId } = body;

  const numScore = Number(score);
  if (!numScore || numScore < 1 || numScore > 10) {
    return NextResponse.json(
      { error: "Оценка должна быть от 1 до 10" },
      { status: 400 }
    );
  }

  // Если оценка за серию — обновляем существующую или создаём
  if (episodeId) {
    const existing = await prisma.rating.findFirst({
      where: {
        userShowId,
        episodeId: Number(episodeId),
      },
    });

    if (existing) {
      const updated = await prisma.rating.update({
        where: { id: existing.id },
        data: { score: numScore },
      });
      return NextResponse.json(updated);
    }

    const rating = await prisma.rating.create({
      data: {
        userShowId,
        episodeId: Number(episodeId),
        score: numScore,
      },
    });
    return NextResponse.json(rating, { status: 201 });
  }

  // Оценка за весь тайтл — ищем оценку без episodeId
  const existingWhole = await prisma.rating.findFirst({
    where: { userShowId, episodeId: null },
  });

  if (existingWhole) {
    const updated = await prisma.rating.update({
      where: { id: existingWhole.id },
      data: { score: numScore },
    });
    return NextResponse.json(updated);
  }

  const rating = await prisma.rating.create({
    data: { userShowId, episodeId: null, score: numScore },
  });
  return NextResponse.json(rating, { status: 201 });
}

// DELETE — удалить оценку (все или конкретную)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const userShowId = Number(idStr);

  const userShow = await prisma.userShow.findFirst({
    where: { id: userShowId, userId: me.id },
  });
  if (!userShow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ratingId = new URL(req.url).searchParams.get("ratingId");

  if (ratingId) {
    await prisma.rating.deleteMany({
      where: { id: Number(ratingId), userShowId },
    });
  } else {
    await prisma.rating.deleteMany({ where: { userShowId } });
  }

  return NextResponse.json({ ok: true });
}