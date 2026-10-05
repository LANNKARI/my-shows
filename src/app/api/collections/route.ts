import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const collections = await prisma.collection.findMany({
    include: { items: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const c = await prisma.collection.create({ data: { name } });
  return NextResponse.json(c, { status: 201 });
}