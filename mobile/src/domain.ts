export type Episode = { id: number; season: number; episode: number };
export type LibraryItem = {
  showId: number;
  userShowId: number;
  title: string;
  kind: string;
  status: string;
  posterUrl: string | null;
  year?: string;
  totalEpisodes: number;
  updatedAt: string;
  show: { episodes: Episode[] };
  progress: { episodeId: number; watched: boolean; stoppedAt: string | null }[];
};
export const statuses = [
  { value: "watching", label: "Смотрю" },
  { value: "planned", label: "В планах" },
  { value: "completed", label: "Просмотрено" },
  { value: "dropped", label: "Брошено" },
];
export function progress(item: LibraryItem) {
  const episodes = [...item.show.episodes].sort(
    (a, b) => a.season - b.season || a.episode - b.episode || a.id - b.id,
  );
  const valid = new Set(episodes.map((e) => e.id));
  const watched = new Set(
    item.progress
      .filter((p) => p.watched && valid.has(p.episodeId))
      .map((p) => p.episodeId),
  );
  const total =
    item.kind === "movie" ? 1 : Math.max(item.totalEpisodes, episodes.length);
  return {
    watched: item.kind === "movie" ? Math.min(watched.size, 1) : watched.size,
    total,
    next: episodes.find((e) => !watched.has(e.id)),
    percent: total ? Math.min(100, (watched.size / total) * 100) : 0,
  };
}
export function canMark(item: LibraryItem) {
  return (
    (item.status === "watching" ||
      (item.kind === "movie" && item.status === "planned")) &&
    (item.kind === "movie" || !!progress(item).next)
  );
}
