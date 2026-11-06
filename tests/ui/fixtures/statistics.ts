import {
  viewingStatistics,
  type StatisticsEntry,
} from "../../../src/lib/viewing-statistics";
export function statisticsFixture(days = 30, empty = false) {
  const now = new Date("2026-11-07T18:00:00Z");
  const entries: StatisticsEntry[] = Array.from({ length: 40 }, (_, i) => {
    const movie = i < 24,
      count = movie ? 1 : i === 39 ? 24 : 12 + (i % 3) * 4;
    return {
      status:
        i % 8 === 0
          ? "dropped"
          : i % 5 === 0
            ? "planned"
            : i % 2
              ? "completed"
              : "watching",
      totalEpisodes: count,
      show: {
        id: i + 1,
        kind: movie ? "movie" : "series",
        runtime: movie ? 110 + (i % 30) : 42,
        year: String(1995 + (i % 31)),
        genres: [
          [
            "Драма",
            "Триллер",
            "Комедия",
            "Фантастика",
            "Детектив",
            "Приключения",
          ][i % 6],
          i % 2 ? "Драма" : "Триллер",
        ],
        countries: [["США", "Великобритания", "Россия", "Франция"][i % 4]],
        episodes: Array.from({ length: count }, (_, j) => ({
          id: i * 100 + j + 1,
          season: Math.floor(j / 8) + 1,
        })),
      },
      progress: Array.from({ length: count }, (_, j) => ({
        episodeId: i * 100 + j + 1,
        watched: true,
        watchedAt: new Date(
          i === 39
            ? Date.UTC(2026, 10, 7, 12)
            : Date.UTC(2026, 10, 7 - ((i * 7 + j * 3) % 90), 17 + (i % 4)),
        ),
        statisticsSource:
          i % 7 === 0 ? "import" : i % 9 === 0 ? "legacy" : "manual",
      })),
      ratings: [{ score: 6 + (i % 5), episodeId: null, createdAt: now }],
    };
  });
  const stats = viewingStatistics(
    empty ? [] : entries,
    days,
    "Asia/Yekaterinburg",
    now,
  );
  return {
    ...stats,
    percentile: {
      value: empty ? null : 82,
      participants: empty ? 0 : 125,
      views: stats.totals.movies + stats.totals.episodes,
    },
  };
}
