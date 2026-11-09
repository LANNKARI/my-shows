import assert from "node:assert/strict";
import { test } from "node:test";
import { DataCache } from "../src/data-cache";
import { ProgressQueue, libraryPath } from "../src/progress-queue";
import { LibraryItem } from "../src/domain";
const entry: LibraryItem = {
  userShowId: 10,
  showId: 20,
  title: "Test",
  kind: "series",
  status: "watching",
  posterUrl: null,
  totalEpisodes: 2,
  updatedAt: "2026-01-01T00:00:00Z",
  show: {
    episodes: [
      { id: 1, season: 1, episode: 1 },
      { id: 2, season: 1, episode: 2 },
    ],
  },
  progress: [],
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const writes: {
    body: { episodeId: number; watched: boolean };
    resolve: (data: unknown) => void;
    reject: (e: Error) => void;
  }[] = [];
  let reads = 0;
  const cache = new DataCache(<T>(path: string, init?: RequestInit) => {
    if (!init?.method) {
      reads++;
      return Promise.resolve([entry] as T);
    }
    return new Promise<unknown>((resolve, reject) =>
      writes.push({ body: JSON.parse(String(init.body)), resolve, reject }),
    ) as Promise<T>;
  });
  cache.set(libraryPath, [entry]);
  return { cache, queue: new ProgressQueue(cache), writes, reads: () => reads };
}
const reply = (ids: number[], revision: number) => ({
  item: {
    status: ids.length === 2 ? "completed" : "watching",
    updatedAt: `2026-01-01T00:00:0${revision}Z`,
    progress: ids.map((episodeId) => ({
      episodeId,
      watched: true,
      stoppedAt: null,
    })),
  },
});
test("a delayed first write allows a second episode, with no preview loss after acknowledgement", async () => {
  const { cache, queue, writes } = fixture();
  queue.enqueue(entry, 1, true);
  queue.enqueue(entry, 2, true);
  assert.equal(writes.length, 1, "network writes for one title are serialized");
  assert.deepEqual(
    cache.get<LibraryItem[]>(libraryPath)![0].progress.map((p) => p.episodeId),
    [1, 2],
  );
  writes[0].resolve(reply([1], 1));
  await tick();
  assert.equal(writes.length, 2);
  assert.equal(
    cache.get<LibraryItem[]>(libraryPath)![0].progress.filter((p) => p.watched)
      .length,
    2,
    "first reply preserves the pending second checkbox",
  );
  writes[1].resolve(reply([1, 2], 2));
  await tick();
  assert.equal(cache.libraryWrite.busy, false);
  assert.equal(cache.get<LibraryItem[]>(libraryPath)![0].status, "completed");
});
test("mark then immediate unmark keeps the final intent, without waiting for the first response", async () => {
  const { cache, queue, writes } = fixture();
  queue.enqueue(entry, 1, true);
  queue.enqueue(entry, 1, false);
  assert.equal(
    cache.get<LibraryItem[]>(libraryPath)![0].progress[0].watched,
    false,
  );
  writes[0].resolve(reply([1], 1));
  await tick();
  assert.deepEqual(writes[1].body, { episodeId: 1, watched: false });
  assert.equal(
    cache.get<LibraryItem[]>(libraryPath)![0].progress[0].watched,
    false,
  );
  writes[1].resolve(reply([], 2));
  await tick();
  assert.equal(cache.libraryWrite.busy, false);
});
test("duplicate same-state taps coalesce to one write", async () => {
  const { queue, writes } = fixture();
  queue.enqueue(entry, 1, true);
  queue.enqueue(entry, 1, true);
  writes[0].resolve(reply([1], 1));
  await tick();
  assert.equal(writes.length, 1);
});
test("uncertain failures cancel queued writes and reconcile once without replay", async () => {
  const { queue, writes, reads, cache } = fixture();
  queue.enqueue(entry, 1, true);
  queue.enqueue(entry, 2, true);
  writes[0].reject(Error("lost reply"));
  await tick();
  assert.equal(writes.length, 1);
  assert.equal(reads(), 1);
  assert.equal(cache.libraryWrite.needsRefresh, false);
  assert.deepEqual(cache.get<LibraryItem[]>(libraryPath)![0].progress, []);
});
test("different titles save independently", async () => {
  const { cache, queue, writes } = fixture();
  const second = { ...entry, userShowId: 11, showId: 21 };
  cache.set(libraryPath, [entry, second]);
  queue.enqueue(entry, 1, true);
  queue.enqueue(second, 2, true);
  assert.equal(writes.length, 2);
  writes[0].resolve(reply([1], 1));
  await tick();
  assert.equal(cache.libraryWrite.busy, true);
  writes[1].resolve(reply([2], 1));
  await tick();
  assert.equal(cache.libraryWrite.busy, false);
});

test("queued quick marks use the preceding authoritative revision", async () => {
  const bodies: Record<string, unknown>[] = [];
  const releases: ((value: unknown) => void)[] = [];
  const cache = new DataCache(<T>(_path: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Promise<unknown>((resolve) =>
      releases.push(resolve),
    ) as Promise<T>;
  });
  cache.set(libraryPath, [entry]);
  const queue = new ProgressQueue(cache);
  queue.enqueue(entry, 1, true, true);
  queue.enqueue(entry, 2, true, true);
  assert.equal(bodies.length, 1);
  releases[0](reply([1], 1));
  await tick();
  assert.equal(bodies[1].expectedEpisodeId, 2);
  assert.equal(bodies[1].expectedUpdatedAt, "2026-01-01T00:00:01Z");
  releases[1](reply([1, 2], 2));
  await tick();
  assert.equal(cache.libraryWrite.busy, false);
});
