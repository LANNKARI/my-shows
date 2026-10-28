import { summarizeProgress } from "./progress";
export const libraryStatuses = [
  { value: "watching", label: "Смотрю", empty: "Вы пока ничего не смотрите" },
  { value: "planned", label: "В планах", empty: "Пока нет планов на просмотр" },
  {
    value: "completed",
    label: "Просмотрено",
    empty: "Здесь появятся просмотренные тайтлы",
  },
  { value: "dropped", label: "Брошено", empty: "Брошенных тайтлов пока нет" },
] as const;
export type LibraryStatus = (typeof libraryStatuses)[number]["value"];
export type LibraryEpisode = { id: number; season: number; episode: number };
export type LibraryItem = {
  hasNote?: boolean;
  id: number;
  userShowId: number;
  showId: number;
  title: string;
  originalTitle?: string | null;
  originalName?: string | null;
  year?: string | null;
  posterUrl?: string | null;
  kind: string;
  status: string;
  totalEpisodes: number;
  userRating?: number | null;
  tmdbRating?: number | null;
  updatedAt: string;
  show: { id: number; episodes: LibraryEpisode[] };
  progress: { episodeId: number; watched: boolean; stoppedAt: string | null }[];
  ratings: { episodeId: number | null; score: number }[];
};

export function personalRating(item: LibraryItem): number | null {
  return (
    item.userRating ??
    item.ratings.find((rating) => rating.episodeId === null)?.score ??
    null
  );
}

export function libraryProgress(item: LibraryItem) {
  const movie = item.kind === "movie";
  const validIds = new Set(item.show.episodes.map((episode) => episode.id));
  const summary = summarizeProgress({
    ...item,
    show: { ...item.show, kind: item.kind },
  });
  const watchedIds = new Set(
    item.progress
      .filter(
        (progress) => progress.watched && validIds.has(progress.episodeId),
      )
      .map((progress) => progress.episodeId),
  );
  const episodes = [...item.show.episodes].sort(
    (a, b) => a.season - b.season || a.episode - b.episode || a.id - b.id,
  );
  const total = summary.total;
  const watched = summary.watched;
  const next = episodes.find((episode) => !watchedIds.has(episode.id));
  const stopped =
    item.progress.find(
      (progress) =>
        progress.episodeId === next?.id &&
        !progress.watched &&
        progress.stoppedAt,
    ) ??
    item.progress.find(
      (progress) =>
        !progress.watched &&
        progress.stoppedAt &&
        validIds.has(progress.episodeId),
    );
  const stoppedEpisode = stopped
    ? episodes.find((episode) => episode.id === stopped.episodeId)
    : undefined;
  return {
    movie,
    watched,
    total,
    next,
    stopped,
    stoppedEpisode,
    percent:
      total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : null,
  };
}

export function filterLibrary(
  items: LibraryItem[],
  status: string,
  query: string,
  type: string,
  sort: string,
) {
  const search = query.trim().toLocaleLowerCase("ru");
  const collator = new Intl.Collator("ru", {
    numeric: true,
    sensitivity: "base",
  });
  const filtered = items.filter(
    (item) =>
      item.status === status &&
      (type === "all" || item.kind === type) &&
      (!search ||
        [item.title, item.originalTitle, item.originalName].some((value) =>
          value?.toLocaleLowerCase("ru").includes(search),
        )),
  );
  return filtered.sort((a, b) => {
    const titleOrder =
      collator.compare(a.title, b.title) || a.showId - b.showId;
    if (sort === "title") return titleOrder;
    if (sort === "rating")
      return (
        (personalRating(b) ?? -1) - (personalRating(a) ?? -1) || titleOrder
      );
    return (
      (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) ||
      titleOrder
    );
  });
}
