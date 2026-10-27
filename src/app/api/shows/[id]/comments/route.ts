import {
  activityEvents,
  titleIdentity,
  lockWallet,
} from "@/lib/popcorn-economy";
import { achievementStats } from "@/lib/achievement-stats";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { calculateAchievements } from "@/lib/achievements";

// GET — комментарии к Show
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const showId = Number(idStr);
  if (!showId)
    return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { showId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          avatarFrame: true,
        },
      },
    },
  });

  const me = await getCurrentUser();

  // Кеш topBadge по userId, чтобы не пересчитывать для одного автора много раз
  const userBadgesCache = new Map<
    string,
    ReturnType<typeof calculateAchievements>[number] | null
  >();

  async function getTopBadge(userId: string) {
    if (userBadgesCache.has(userId)) return userBadgesCache.get(userId);

    const badges = calculateAchievements(await achievementStats(userId))
      .filter((a) => a.unlocked)
      .sort((a, b) => {
        const order: Record<string, number> = {
          legend: 0,
          gold: 1,
          silver: 2,
          bronze: 3,
        };
        return order[a.tier] - order[b.tier];
      });

    const top = badges[0] || null;
    userBadgesCache.set(userId, top);
    return top;
  }

  const result = await Promise.all(
    comments.map(async (c) => {
      const badge = await getTopBadge(c.userId);
      return {
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        user: c.user,
        isOwn: me?.id === c.userId,
        topBadge: badge
          ? {
              id: badge.id,
              name: badge.name,
              icon: badge.icon,
              tier: badge.tier,
              description: badge.description,
            }
          : null,
      };
    }),
  );

  return NextResponse.json(result);
}

// POST — создать комментарий
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const showId = Number(idStr);

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show)
    return NextResponse.json({ error: "show not found" }, { status: 404 });

  const body = await req.json();
  const text = String(body.text || "").trim();

  if (!text) {
    return NextResponse.json(
      { error: "Комментарий не может быть пустым" },
      { status: 400 },
    );
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Комментарий слишком длинный (макс. 1000 символов)" },
      { status: 400 },
    );
  }

  const comment = await prisma.$transaction(async (tx) => {
    if (Array.from(text).length >= 100) await lockWallet(tx, me.id);
    const comment = await tx.comment.create({
      data: { showId, userId: me.id, text },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
            avatarFrame: true,
          },
        },
      },
    });

    if (Array.from(text).length >= 100) {
      const show = await tx.show.findUnique({ where: { id: showId } });
      if (show)
        await activityEvents(tx, me.id, [
          {
            key: `review:${titleIdentity(show)}`,
            amount: 10,
            reason: `Публичный отзыв: ${show.name}`,
          },
        ]);
    }
    return comment;
  });
  // Для нового комментария считаем бейдж автора
  const badges = calculateAchievements(await achievementStats(me.id))
    .filter((a) => a.unlocked)
    .sort((a, b) => {
      const order: Record<string, number> = {
        legend: 0,
        gold: 1,
        silver: 2,
        bronze: 3,
      };
      return order[a.tier] - order[b.tier];
    });

  const top = badges[0] || null;

  return NextResponse.json(
    {
      ...comment,
      isOwn: true,
      topBadge: top
        ? {
            id: top.id,
            name: top.name,
            icon: top.icon,
            tier: top.tier,
            description: top.description,
          }
        : null,
    },
    { status: 201 },
  );
}
