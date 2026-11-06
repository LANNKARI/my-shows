import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewingStatistics,
  type StatisticsEntry,
} from "../src/lib/viewing-statistics";
const now = new Date("2026-11-07T18:00:00Z");
function entry(
  count = 1,
  source = "manual",
  date = "2026-11-07T12:00:00Z",
  runtime: number | null = 45,
): StatisticsEntry {
  return {
    status: "watching",
    totalEpisodes: count,
    show: {
      id: 1,
      kind: "series",
      runtime,
      year: "2026",
      genres: ["Драма", "Драма", "Триллер"],
      countries: ["RU", "RU"],
      episodes: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        season: 1,
      })),
    },
    progress: Array.from({ length: count }, (_, i) => ({
      episodeId: i + 1,
      watched: true,
      watchedAt: new Date(date),
      statisticsSource: source,
    })),
    ratings: [
      { score: 8, episodeId: null, createdAt: now },
      { score: 1, episodeId: 1, createdAt: now },
    ],
  };
}
test("genres count titles once, seasons and personal ratings ignore episode-level ratings", () => {
  const a = entry(20);
  a.show.episodes.push({ id: 21, season: 2 });
  const s = viewingStatistics([a], 30, "UTC", now);
  assert.equal(s.totals.episodes, 20);
  assert.equal(s.totals.minutes, 900);
  assert.deepEqual(s.genres, [
    { name: "Драма", count: 1 },
    { name: "Триллер", count: 1 },
  ]);
  assert.deepEqual(s.countries, [{ name: "RU", count: 1 }]);
  assert.equal(s.totals.series, 1);
  assert.equal(s.totals.completedSeries, 0);
  assert.equal(s.totals.seasons, 1);
  assert.equal(s.totals.completedSeasons, 1);
  assert.equal(s.ratings.average, 8);
  assert.equal(s.ratings.count, 1);
});
test("exactly 15h remains eligible; more than 15h stays in heatmap/streak but not averages/favorites", () => {
  const a = entry(20);
  let s = viewingStatistics([a], 30, "UTC", now);
  assert.equal(s.activity.bulkDays, 0);
  assert.equal(s.activity.cleanMinutes, 900);
  a.show.episodes.push({ id: 21, season: 1 });
  a.progress.push({
    episodeId: 21,
    watched: true,
    watchedAt: new Date("2026-11-07T12:00:00Z"),
    statisticsSource: "manual",
  });
  const b = entry(1, "manual", "2026-11-06T19:00:00Z", 60);
  s = viewingStatistics([a, b], 30, "UTC", now);
  assert.equal(s.totals.minutes, 1005);
  assert.equal(s.activity.bulkDays, 1);
  assert.equal(s.activity.cleanMinutes, 60);
  assert.equal(s.activity.eligibleDays, 29);
  assert.equal(s.activity.averageDay, 60 / 29);
  assert.equal(s.activity.averageWeek, (60 / 29) * 7);
  assert.equal(s.heatmap.at(-1)?.count, 21);
  assert.equal(s.activity.currentStreak, 2);
  assert.equal(s.activity.longestStreak, 2);
  assert.equal(s.activity.favoriteDay, "Пятница");
  assert.equal(s.activity.favoritePart, "Вечер");
  assert.equal(s.monthly.at(-1)?.minutes, 1005);
});
test("imports, legacy, undated and future-dated marks remain in totals without fabricating activity", () => {
  const rows = [
    entry(30, "import"),
    entry(2, "legacy"),
    entry(1, "manual", "2030-01-01T00:00:00Z"),
    entry(1),
  ];
  rows[3].progress[0].watchedAt = null;
  const s = viewingStatistics(rows, 90, "UTC", now);
  assert.equal(s.totals.episodes, 34);
  assert.equal(s.totals.imported, 30);
  assert.equal(s.totals.legacy, 2);
  assert.equal(s.totals.undated, 1);
  assert.equal(s.activity.activeDays, 0);
  assert.equal(s.activity.currentStreak, 0);
  assert.equal(s.activity.favoriteDay, null);
  assert.equal(s.activity.averageDay, 0);
});
test("an import does not invalidate manual views on the same day", () => {
  const s = viewingStatistics([entry(100, "import"), entry(1)], 30, "UTC", now);
  assert.equal(s.totals.episodes, 101);
  assert.equal(s.activity.cleanMinutes, 45);
  assert.equal(s.activity.bulkDays, 0);
  assert.equal(s.heatmap.at(-1)?.count, 1);
});
test("movies count once, completed legacy movies without progress retain hours, foreign episodes never count", () => {
  const a = entry(2);
  a.show.kind = "movie";
  a.show.runtime = 120;
  const b = entry(0);
  b.show.id = 2;
  b.show.kind = "movie";
  b.show.runtime = 100;
  b.status = "completed";
  const c = entry(1);
  c.progress[0].episodeId = 999;
  const s = viewingStatistics([a, b, c], 365, "UTC", now);
  assert.equal(s.totals.movies, 2);
  assert.equal(s.totals.episodes, 0);
  assert.equal(s.totals.movieMinutes, 220);
  assert.equal(s.activity.cleanMinutes, 120);
  assert.equal(s.totals.undated, 1);
});
test("local day boundaries and DST use the chosen IANA timezone, not UTC", () => {
  const a = entry(1, "manual", "2026-11-06T20:30:00Z");
  const s = viewingStatistics([a], 30, "Asia/Yekaterinburg", now);
  assert.equal(s.daily.at(-1)?.count, 1);
  assert.equal(s.activity.favoriteDay, "Суббота");
  assert.equal(s.activity.favoritePart, "Ночь");
  const b = entry(2, "manual", "2026-11-01T05:30:00Z");
  b.progress[1].watchedAt = new Date("2026-11-01T06:30:00Z");
  const dst = viewingStatistics([b], 30, "America/New_York", now);
  assert.equal(dst.daily.find((d) => d.date === "2026-11-01")?.count, 2);
});
test("all 30 days excluded yields no average; a broken streak resets while longest is retained", () => {
  const a = entry(1, "manual", "2026-10-01T12:00:00Z");
  const b = entry(1, "manual", "2026-10-02T12:00:00Z");
  const s = viewingStatistics([a, b], 30, "UTC", now);
  assert.equal(s.activity.currentStreak, 0);
  assert.equal(s.activity.longestStreak, 2);
  const all = Array.from({ length: 30 }, (_, i) =>
    entry(21, "manual", new Date(Date.UTC(2026, 10, 7 - i, 12)).toISOString()),
  );
  const t = viewingStatistics(all, 30, "UTC", now);
  assert.equal(t.activity.eligibleDays, 0);
  assert.equal(t.activity.averageDay, null);
  assert.equal(t.activity.averageWeek, null);
  assert.equal(t.activity.currentStreak, 30);
});
test("missing durations are explicitly estimated and specials are not seasons", () => {
  const a = entry(1, "manual", undefined, null);
  a.show.episodes[0].season = 0;
  const s = viewingStatistics([a], 30, "UTC", now);
  assert.equal(s.totals.minutes, 45);
  assert.equal(s.totals.estimated, 1);
  assert.equal(s.totals.seasons, 0);
});
