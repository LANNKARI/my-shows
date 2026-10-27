import { summarizeLibrary } from "@/lib/progress";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUserId,
  formatPosterUrl,
  safeJson,
} from "@/lib/current-user";
import { calculateAchievements } from "@/lib/achievements";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
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
        avatarFrame: true,
        profileStyle: true,
        bannerUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 },
      );
    }

    const isOwnProfile = currentUserId === user.id;

    let friendshipStatus:
      | "none"
      | "pending_sent"
      | "pending_received"
      | "friends" = "none";

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
        if (relation.status === "accepted") {
          friendshipStatus = "friends";
        } else if (relation.requesterId === currentUserId) {
          friendshipStatus = "pending_sent";
        } else {
          friendshipStatus = "pending_received";
        }
      }
    }

    // 1. Все тайтлы пользователя в библиотеке
    const userShows = await prisma.userShow.findMany({
      where: { userId: user.id },
      include: {
        show: {
          include: { episodes: true },
        },
        ratings: true,
        progress: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // 2. Строго завершенные тайтлы (status === 'completed')
    const completedUserShows = userShows.filter(
      (us) => us.status === "completed",
    );

    const completedShows = completedUserShows.map((us) => {
      const posterUrl = formatPosterUrl(us.show?.posterUrl);
      const isMovie = us.show.kind === "movie";
      return {
        id: us.id,
        showId: us.showId,
        name: us.show?.name || "Без названия",
        title: us.show?.name || "Без названия",
        originalName: us.show?.originalName,
        posterUrl,
        year:
          us.show?.year ||
          (us.show?.releaseDate
            ? new Date(us.show.releaseDate).getFullYear().toString()
            : null),
        kind: isMovie ? "movie" : "series",
        rating:
          us.ratings?.[0]?.score ||
          (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      };
    });

    const moviesCount = completedShows.filter((s) => s.kind === "movie").length;
    const seriesCount = completedShows.filter(
      (s) => s.kind === "series",
    ).length;

    const {
      ratingsCount,
      hoursWatched,
      addedSeriesCount,
      totalTitles,
      watchedEpisodesCount,
      completedSeriesCount,
    } = summarizeLibrary(userShows);

    // 3. Любимые сериалы и фильмы
    const favoriteShows = userShows
      .filter((us) => us.isFavorite)
      .map((us, index) => ({
        id: us.id,
        showId: us.showId,
        rank: index + 1,
        name: us.show?.name || "Без названия",
        title: us.show?.name || "Без названия",
        posterUrl: formatPosterUrl(us.show?.posterUrl),
        year: us.show?.year || null,
        kind: us.show.kind,
        rating:
          us.ratings?.[0]?.score ||
          (us.show?.tmdbRating ? Math.round(us.show.tmdbRating) : null),
      }));

    // Друзья
    const friendsCount = await prisma.friendship.count({
      where: {
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        status: "accepted",
      },
    });

    // Комментарии
    let commentsCount = 0;
    try {
      commentsCount = await prisma.comment.count({
        where: { userId: user.id },
      });
    } catch {
      commentsCount = 0;
    }

    // Возраст аккаунта в днях
    const daysRegistered = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    // 4. Расчет достижений с честным количеством сериалов
    const achievements = calculateAchievements({
      totalTitles,
      addedShowsCount: addedSeriesCount, // Передаем 16 сериалов, а не 57
      totalEpisodes: watchedEpisodesCount,
      watchedEpisodesCount,
      totalRatings: ratingsCount,
      ratingsCount,
      completedSeriesCount,
      commentsCount,
      friendsCount,
      daysRegistered,
    });

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
      }),
    );
  } catch (error: unknown) {
    console.error("Profile unavailable", error);
    return NextResponse.json(
      { error: "Не удалось загрузить профиль. Попробуйте ещё раз." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
