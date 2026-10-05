import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const collection = await prisma.collection.findFirst({
    where: { id, userId: user.id },
    include: {
      items: {
        include: {
          title: {
            include: {
              ratings: true,
              episodes: { select: { watched: true } },
            },
          },
        },
      },
    },
  });

  if (!collection) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(collection);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await prisma.collection.findFirst({
    where: { id, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}