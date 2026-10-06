import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { calculateAchievements } from "@/lib/achievements";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const titleId = Number(idStr);
  if (!titleId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { titleId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  const me = await getCurrentUser();

  // Кеш достижений по userId
  const userBadgesCache = new Map<string, any>();

  async function getTopBadge(userId: string) {
    if (userBadgesCache.has(userId)) return userBadgesCache.get(userId);

    const [titlesCount, completedCount, ratingsCount, commentsCount, watchedEpisodes, friendsCount] =
      await Promise.all([
        prisma.title.count({ where: { userId } }),
        prisma.title.count({ where: { userId, isCompleted: true } }),
        prisma.rating.count({ where: { title: { userId } } }),
        prisma.comment.count({ where: { userId } }),
        prisma.episode.count({ where: { title: { userId }, watched: true } }),
        prisma.friendship.count({
          where: {
            status: "accepted",
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          },
        }),
      ]);

    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const accountAgeDays = u
      ? Math.floor((Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const badges = calculateAchievements({
      totalTitles: titlesCount,
      completedTitles: completedCount,
      totalWatchedEpisodes: watchedEpisodes,
      totalRatings: ratingsCount,
      totalComments: commentsCount,
      totalFriends: friendsCount,
      accountAgeDays,
    })
      .filter((a) => a.unlocked)
      .sort((a, b) => {
        const order: Record<string, number> = {
          legendary: 0,
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
    })
  );

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const titleId = Number(idStr);
  if (!titleId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) return NextResponse.json({ error: "title not found" }, { status: 404 });

  const body = await req.json();
  const text = String(body.text || "").trim();

  if (!text) {
    return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Комментарий слишком длинный (макс. 1000 символов)" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: { titleId, userId: me.id, text },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json(
    { ...comment, isOwn: true, topBadge: null },
    { status: 201 }
  );
}