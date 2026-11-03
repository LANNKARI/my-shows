export type FavoriteTitle = { id: number; showId: number; rank: number; name: string; posterUrl: string | null; year: string | null; kind: string; rating: number | null };
export function sortFavorites<T extends { id: number; favoriteOrder?: number | null; updatedAt: Date | string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.favoriteOrder ?? Infinity) - (b.favoriteOrder ?? Infinity) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || b.id - a.id);
}
