import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { calculateAchievements } from "@/lib/achievements";

// GET — комментарии к Show
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const showId = Number(idStr);
  if (!showId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { showId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  const me = await getCurrentUser();

  const result = comments.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    user: c.user,
    isOwn: me?.id === c.userId,
  }));

  return NextResponse.json(result);
}

// POST — создать комментарий
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const showId = Number(idStr);

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return NextResponse.json({ error: "show not found" }, { status: 404 });

  const body = await req.json();
  const text = String(body.text || "").trim();

  if (!text) {
    return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Комментарий слишком длинный (макс. 1000 символов)" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: { showId, userId: me.id, text },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ ...comment, isOwn: true }, { status: 201 });
}