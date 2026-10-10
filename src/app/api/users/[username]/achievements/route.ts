import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateAchievements } from '@/lib/achievements';
import { safeJson } from '@/lib/current-user';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userShows = await prisma.userShow.findMany({
      where: { userId: user.id },
      include: {
        ratings: true,
        progress: true,
        show: true,
      },
    });

    const totalTitles = userShows.length;

    let watchedEpisodesCount = 0;
    for (const us of userShows) {
      watchedEpisodesCount += (us.progress || []).filter((p) => p.watched).length;
    }

    const completedSeriesCount = userShows.filter(
      (us) => us.status === 'completed' && (us.kind === 'series' || us.show?.kind === 'series')
    ).length;

    const ratingsCount = userShows.filter(
      (us) => us.ratings && us.ratings.length > 0 && us.ratings[0].score > 0
    ).length;

    let commentsCount = 0;
    try {
      commentsCount = await prisma.comment.count({
        where: { userId: user.id },
      });
    } catch {
      commentsCount = 0;
    }

    const friendsCount = await prisma.friendship.count({
      where: {
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        status: 'accepted',
      },
    });

    const daysRegistered = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const achievements = calculateAchievements({
      totalTitles,
      totalEpisodes: watchedEpisodesCount,
      watchedEpisodesCount,
      totalRatings: ratingsCount,
      ratingsCount,
      completedSeriesCount,
      commentsCount,
      friendsCount,
      daysRegistered,
    });

    return NextResponse.json(safeJson(achievements));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}