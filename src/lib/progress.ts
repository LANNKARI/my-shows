/** Canonical counts only: progress referencing another show's episode never counts. */
export function summarizeProgress(entry: {
  status: string;
  totalEpisodes: number;
  show: { kind?: string; episodes: { id: number }[] };
  progress: { episodeId: number; watched: boolean }[];
}) {
  const ids = new Set(entry.show.episodes.map((episode) => episode.id));
  const watchedIds = new Set(
    entry.progress
      .filter((progress) => progress.watched && ids.has(progress.episodeId))
      .map((progress) => progress.episodeId),
  );
  const movie = entry.show.kind === "movie";
  const total = movie ? 1 : Math.max(entry.totalEpisodes, ids.size, 0);
  const watched = movie
    ? Number(watchedIds.size > 0 || entry.status === "completed")
    : watchedIds.size;
  return {
    total,
    watched,
    percent:
      total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : null,
    complete: movie
      ? watched > 0
      : ids.size > 0 && ids.size >= total && watchedIds.size === ids.size,
  };
}

export function summarizeLibrary(
  entries: {
    status: string;
    totalEpisodes: number;
    show: { kind: string; runtime?: number | null; episodes: { id: number }[] };
    progress: { episodeId: number; watched: boolean }[];
    ratings: { episodeId: number | null; score: number }[];
  }[],
) {
  let watchedEpisodesCount = 0;
  let totalMinutes = 0;
  for (const entry of entries) {
    const summary = summarizeProgress(entry);
    const movie = entry.show.kind === "movie";
    if (!movie) watchedEpisodesCount += summary.watched;
    totalMinutes +=
      summary.watched * (entry.show.runtime || (movie ? 110 : 45));
  }
  return {
    totalTitles: entries.filter((entry) => entry.status !== "dropped").length,
    addedSeriesCount: entries.filter(
      (entry) =>
        ["watching", "completed"].includes(entry.status) &&
        entry.show.kind === "series",
    ).length,
    completedCount: entries.filter((entry) => entry.status === "completed")
      .length,
    completedSeriesCount: entries.filter(
      (entry) => entry.status === "completed" && entry.show.kind === "series",
    ).length,
    ratingsCount: entries.filter((entry) =>
      entry.ratings.some(
        (rating) => rating.episodeId === null && rating.score > 0,
      ),
    ).length,
    watchedEpisodesCount,
    hoursWatched: Math.round(totalMinutes / 60),
  };
}
