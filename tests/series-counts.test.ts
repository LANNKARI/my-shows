import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeLibrary } from "../src/lib/progress";
import { calculateAchievements } from "../src/lib/achievements";

test("series counters include only watching and completed series", () => {
  const statuses = ["watching", "completed", "planned", "dropped", "paused", "unknown"];
  const entries = ["series", "movie"].flatMap(kind => statuses.map(status => ({
    status, totalEpisodes: 0, show: {kind, episodes: []}, progress: [], ratings: [],
  })));
  const counts = summarizeLibrary(entries);
  assert.equal(counts.addedSeriesCount, 2);
  assert.equal(counts.completedSeriesCount, 1);
  const achievements = calculateAchievements({addedShowsCount: counts.addedSeriesCount});
  assert.equal(achievements.find(a => a.id === "bibliophile")?.current, 2);
  assert.equal(summarizeLibrary(entries.filter(e => e.status === "planned")).addedSeriesCount, 0);
  assert.equal(summarizeLibrary(entries.filter(e => e.show.kind === "movie")).addedSeriesCount, 0);
});
