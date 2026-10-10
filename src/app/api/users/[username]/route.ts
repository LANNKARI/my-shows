import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, formatPosterUrl, safeJson } from '@/lib/current-user';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const currentUserId = await getCurrentUserId();

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
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const isOwnProfile = currentUserId === user.id;

    // Определение текущего статуса дружбы
    let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' = 'none';

    if (!isOwnProfile && currentUserId) {
      const relation = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: currentUserId, addresseeId: user.id },
            { requesterId: user.id, addresseeId: currentUserId },
          ],
        },
      });

      if (relation) {
        if (relation.status === 'accepted') {
          friendshipStatus = 'friends';
        } else if (relation.requesterId === currentUserId) {
          friendshipStatus = 'pending_sent';
        } else {
          friendshipStatus = 'pending_received';
        }
      }
    }

    // 1. Загружаем сериалы и фильмы пользователя
    const userShows = await prisma.userShow.findMany({
      where: { userId: user.id },
      include: {
        show: {
          include: { episodes: true },
        },
        ratings: true,
        progress: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. Просмотренные картины
    const completedUserShows = userShows.filter(
      (us) => us.status === 'completed' || us.isCompleted
    );

    const completedShows = completedUserShows.map((us) => {
      const posterUrl = formatPosterUrl(us.show?.posterUrl);
      const isMovie = us.kind === 'movie' || us.show?.kind === 'movie';
      return {
        id: us.id,
        showId: us.showId,
        name: us.show?.name || 'Без названия',
        title: us.show?.name || 'Без названия',
        originalName: us.show?.originalName,
        posterUrl,
        year: us.show?.year || (us.show?.releaseDate ? new Date(us.show.releaseDate).getFullYear().toString() : null),
        kind: isMovie ? 'movie' : 'series',
        rating: us.ratings?.[0]?.score || (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      };
    });

    const moviesCount = completedShows.filter((s) => s.kind === 'movie').length;
    const seriesCount = completedShows.filter((s) => s.kind === 'series').length;

    const ratingsCount = userShows.filter(
      (us) => us.ratings && us.ratings.length > 0 && us.ratings[0].score > 0
    ).length;

    // Подсчет времени просмотра
    let totalMinutes = 0;
    for (const us of userShows) {
      const isMovie = us.kind === 'movie' || us.show?.kind === 'movie';
      const runtime = us.show?.runtime || (isMovie ? 110 : 45);

      if (isMovie) {
        if (us.status === 'completed' || us.isCompleted) {
          totalMinutes += runtime;
        }
      } else {
        const watchedEpisodes = (us.progress || []).filter((p) => p.watched).length;
        if (watchedEpisodes > 0) {
          totalMinutes += watchedEpisodes * runtime;
        } else if (us.status === 'completed' || us.isCompleted) {
          const epCount = us.totalEpisodes || us.show?.episodes?.length || 10;
          totalMinutes += epCount * runtime;
        }
      }
    }
    const hoursWatched = Math.round(totalMinutes / 60);

    // 3. Любимые картины (отмеченные звездочкой)
    const favoriteShows = userShows
      .filter((us) => us.isFavorite)
      .map((us, index) => ({
        id: us.id,
        showId: us.showId,
        rank: index + 1,
        name: us.show?.name || 'Без названия',
        title: us.show?.name || 'Без названия',
        posterUrl: formatPosterUrl(us.show?.posterUrl),
        year: us.show?.year || null,
        kind: us.kind || us.show?.kind || 'series',
        rating: us.ratings?.[0]?.score || (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      }));

    // 4. Достижения
    const achievements = [
      {
        id: 'first_watch',
        title: 'Первый шаг',
        description: 'Посмотрите свой первый фильм или сериал',
        icon: '🎬',
        unlocked: completedShows.length >= 1,
        progress: Math.min(completedShows.length, 1),
        maxProgress: 1,
      },
      {
        id: 'cinema_fan',
        title: 'Киноман',
        description: 'Посмотрите 10 фильмов',
        icon: '🍿',
        unlocked: moviesCount >= 10,
        progress: Math.min(moviesCount, 10),
        maxProgress: 10,
      },
      {
        id: 'series_addict',
        title: 'Сериаломаньяк',
        description: 'Завершите просмотр 5 сериалов',
        icon: '📺',
        unlocked: seriesCount >= 5,
        progress: Math.min(seriesCount, 5),
        maxProgress: 5,
      },
      {
        id: 'critic',
        title: 'Взыскательный критик',
        description: 'Поставьте 10 личных оценок',
        icon: '★',
        unlocked: ratingsCount >= 10,
        progress: Math.min(ratingsCount, 10),
        maxProgress: 10,
      },
      {
        id: 'marathoner',
        title: 'Марафонец',
        description: 'Проведите за просмотром более 50 часов',
        icon: '⏱',
        unlocked: hoursWatched >= 50,
        progress: Math.min(hoursWatched, 50),
        maxProgress: 50,
      },
      {
        id: 'golden_top',
        title: 'Золотая коллекция',
        description: 'Отметьте свои любимые картины',
        icon: '⭐',
        unlocked: favoriteShows.length >= 1,
        progress: Math.min(favoriteShows.length, 5),
        maxProgress: 5,
      },
    ];

    return NextResponse.json(
      safeJson({
        user,
        isOwnProfile,
        friendshipStatus,
        stats: {
          totalCompleted: completedShows.length,
          moviesCount,
          seriesCount,
          ratingsCount,
          hoursWatched,
        },
        favorites: favoriteShows,
        achievements,
        completedShows,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}