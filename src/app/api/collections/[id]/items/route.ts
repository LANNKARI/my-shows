import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const collectionId = Number(idStr);
  const { titleId } = await req.json();

  try {
    const item = await prisma.collectionItem.create({
      data: { collectionId, titleId: Number(titleId) },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "already exists" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const collectionId = Number(idStr);
  const titleId = Number(new URL(req.url).searchParams.get("titleId"));
  await prisma.collectionItem.deleteMany({ where: { collectionId, titleId } });
  return NextResponse.json({ ok: true });
}