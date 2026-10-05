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
  const collectionId = Number(idStr);
  const { titleId } = await req.json();

  // Проверяем, что коллекция наша
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId: user.id },
  });
  if (!collection) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Проверяем, что сериал наш
  const title = await prisma.title.findFirst({
    where: { id: Number(titleId), userId: user.id },
  });
  if (!title) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const item = await prisma.collectionItem.create({
      data: { collectionId, titleId: Number(titleId) },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "already exists" }, { status: 409 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const collectionId = Number(idStr);

  // Проверяем, что коллекция наша
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId: user.id },
  });
  if (!collection) return NextResponse.json({ error: "not found" }, { status: 404 });

  const titleId = Number(new URL(req.url).searchParams.get("titleId"));
  await prisma.collectionItem.deleteMany({ where: { collectionId, titleId } });

  return NextResponse.json({ ok: true });
}