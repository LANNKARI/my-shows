import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

const MAX_FAVORITES = 5;

export async function PATCH(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const titleId = Number(idStr);

  const title = await prisma.title.findFirst({
    where: { id: titleId, userId: me.id },
  });
  if (!title) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Пытаемся добавить в любимые
  if (!title.isFavorite) {
    const favCount = await prisma.title.count({
      where: { userId: me.id, isFavorite: true },
    });
    if (favCount >= MAX_FAVORITES) {
      return NextResponse.json(
        { error: `Максимум ${MAX_FAVORITES} любимых сериалов` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.title.update({
    where: { id: titleId },
    data: { isFavorite: !title.isFavorite },
  });

  return NextResponse.json(updated);
}