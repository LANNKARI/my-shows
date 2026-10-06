import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.userShow.findMany({
    where: {
      userId: me.id,
      status: "wishlist",
    },
    orderBy: { updatedAt: "desc" },
    include: {
      show: true,
    },
  });

  const result = items.map((us) => ({
    id: us.id,                    // UserShow.id
    showId: us.show.id,            // Show.id
    name: us.show.name,
    originalName: us.show.originalName,
    posterUrl: us.show.posterUrl,
    kind: us.show.kind,
    year: us.show.year,
    tmdbRating: us.show.tmdbRating,
    status: us.status,
    updatedAt: us.updatedAt,
  }));

  return NextResponse.json(result);
}