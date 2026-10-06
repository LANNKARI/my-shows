import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { calculateAchievements } from "@/lib/achievements";

// GET — комментарии к Show
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const showId = Number(idStr);
  if (!showId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { showId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  const me = await getCurrentUser();

  // Кеш topBadge по userId, чтобы не пересчитывать для одного автора много раз
  const userBadgesCache = new Map<string, any>();

  async function getTopBadge(userId: string) {
    if (userBadgesCache.has(userId)) return userBadgesCache.get(userId);

    const [
      userShowsCount,
      completedCount,
      ratingsCount,
      commentsCount,
      watchedEpisodes,
      friendsCount,
    ] = await Promise.all([
      prisma.userShow.count({ where: { userId } }),
      prisma.userShow.count({ where: { userId, isCompleted: true } }),
      prisma.rating.count({ where: { userShow: { userId } } }),
      prisma.comment.count({ where: { userId } }),
      prisma.episodeProgress.count({
        where: { userShow: { userId }, watched: true },
      }),
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
      totalTitles: userShowsCount,
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

// POST — создать комментарий
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const showId = Number(idStr);

  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) return NextResponse.json({ error: "show not found" }, { status: 404 });

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
    data: { showId, userId: me.id, text },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  // Для нового комментария считаем бейдж автора
  const [
    userShowsCount,
    completedCount,
    ratingsCount,
    commentsCount,
    watchedEpisodes,
    friendsCount,
  ] = await Promise.all([
    prisma.userShow.count({ where: { userId: me.id } }),
    prisma.userShow.count({ where: { userId: me.id, isCompleted: true } }),
    prisma.rating.count({ where: { userShow: { userId: me.id } } }),
    prisma.comment.count({ where: { userId: me.id } }),
    prisma.episodeProgress.count({
      where: { userShow: { userId: me.id }, watched: true },
    }),
    prisma.friendship.count({
      where: {
        status: "accepted",
        OR: [{ requesterId: me.id }, { addresseeId: me.id }],
      },
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { createdAt: true },
  });
  const accountAgeDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const badges = calculateAchievements({
    totalTitles: userShowsCount,
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
    { status: 201 }
  );
}