import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
