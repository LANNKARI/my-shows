import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, formatPosterUrl } from "@/lib/current-user";
import { privateJson, calendarFailure } from "@/lib/calendar-server";
import { sortFavorites } from "@/lib/favorites";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const [user, viewer] = await Promise.all([
      prisma.user.findUnique({ where: { username }, select: { id: true, username: true, name: true } }),
      getCurrentUserId(),
    ]);
    if (!user) return Response.json({ error: "Пользователь не найден" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const rows = await prisma.userShow.findMany({ where: { userId: user.id, isFavorite: true }, select: { id: true, showId: true, favoriteOrder: true, updatedAt: true, show: { select: { name: true, posterUrl: true, year: true, kind: true, tmdbRating: true } }, ratings: { where: { episodeId: null }, select: { score: true } } } });
    return privateJson({ user: { username: user.username, name: user.name }, isOwnProfile: viewer === user.id, items: sortFavorites(rows).map((row, index) => ({ id: row.id, showId: row.showId, rank: index + 1, name: row.show.name, posterUrl: formatPosterUrl(row.show.posterUrl), year: row.show.year, kind: row.show.kind, rating: row.ratings[0]?.score || (row.show.tmdbRating ? Math.round(row.show.tmdbRating) : null) })) });
  } catch (error) { return calendarFailure(error); }
}
