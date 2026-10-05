import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: me.id } },
        {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
    },
    take: 20,
  });

  // Для каждого — статус дружбы с текущим пользователем
  const result = await Promise.all(
    users.map(async (u) => {
      const f = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: me.id, addresseeId: u.id },
            { requesterId: u.id, addresseeId: me.id },
          ],
        },
      });

      let status: "none" | "pending_out" | "pending_in" | "friends" = "none";
      if (f) {
        if (f.status === "accepted") status = "friends";
        else if (f.requesterId === me.id) status = "pending_out";
        else status = "pending_in";
      }

      return {
        id: u.id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl,
        friendshipStatus: status,
      };
    })
  );

  return NextResponse.json(result);
}