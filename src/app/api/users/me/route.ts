import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: any = {};

  if ("name" in body) {
    const name = String(body.name || "").trim();
    data.name = name || null;
  }
  if ("bio" in body) {
    const bio = String(body.bio || "").trim();
    if (bio.length > 300) {
      return NextResponse.json(
        { error: "Bio не должен превышать 300 символов" },
        { status: 400 }
      );
    }
    data.bio = bio || null;
  }
  if ("avatarUrl" in body) {
    data.avatarUrl = body.avatarUrl || null;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, username: true, name: true, bio: true, avatarUrl: true },
  });

  return NextResponse.json(updated);
}