import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const collection = await prisma.collection.findUnique({
    where: { id },
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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  await prisma.collection.delete({ where: { id: Number(idStr) } });
  return NextResponse.json({ ok: true });
}