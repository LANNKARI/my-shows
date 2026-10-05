import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const c = await prisma.collection.create({
    data: { name, userId: user.id },
  });

  return NextResponse.json(c, { status: 201 });
}