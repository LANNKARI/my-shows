import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Загружаем только тайтлы со статусом "completed" (строго исключая dropped)
    const userShows = await prisma.userShow.findMany({
      where: {
        userId: user.id,
        status: 'completed',
      },
      include: {
        show: true,
        ratings: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const completedShows = userShows.map((us) => {
      const rawPoster = us.show?.posterUrl;
      const posterUrl = rawPoster
        ? rawPoster.startsWith('http')
          ? rawPoster
          : `https://image.tmdb.org/t/p/w500${rawPoster.startsWith('/') ? '' : '/'}${rawPoster}`
        : null;

      return {
        id: us.id,
        showId: us.showId,
        name: us.show?.name || 'Без названия',
        title: us.show?.name || 'Без названия',
        posterUrl,
        year: us.show?.year || null,
        kind: us.kind || us.show?.kind || 'series',
        rating: us.ratings?.[0]?.score || (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      };
    });

    return NextResponse.json({
      user,
      completedShows,
      stats: {
        totalCompleted: completedShows.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}