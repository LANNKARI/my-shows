import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    if (!currentUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      currentUserId = firstUser?.id;
    }

    // Загружаем записи из UserShow
    const userShows = currentUserId
      ? await prisma.userShow.findMany({
          where: { userId: currentUserId },
          include: {
            show: { include: { episodes: true } },
            ratings: true,
            progress: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    const normalized = userShows.map((us) => ({
      id: us.showId,
      userShowId: us.id,
      showId: us.showId,
      name: us.show?.name,
      title: us.show?.name,
      originalName: us.show?.originalName,
      posterUrl: us.show?.posterUrl,
      kind: us.kind,
      status: us.status,
      isCompleted: us.isCompleted,
      isFavorite: us.isFavorite,
      totalSeasons: us.totalSeasons,
      totalEpisodes: us.totalEpisodes,
      dubbing: us.dubbing,
      watchSite: us.watchSite,
      tmdbRating: us.show?.tmdbRating,
      show: us.show,
      ratings: us.ratings,
      progress: us.progress,
    }));

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}