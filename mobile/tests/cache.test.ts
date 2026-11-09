import assert from "node:assert/strict";
import { test } from "node:test";
import { DataCache } from "../src/data-cache";
const library = "/api/user-shows?status=library";
test("navigation reuses fresh private data and concurrent reads share one request", async () => {
  let calls = 0;
  let release!: (value: unknown) => void;
  const cache = new DataCache(<T>() => {
    calls++;
    return new Promise<unknown>((resolve) => {
      release = resolve;
    }) as Promise<T>;
  });
  const a = cache.load(library),
    b = cache.load(library);
  release([{ title: "A" }]);
  assert.deepEqual(await a, await b);
  assert.equal(calls, 1);
  await cache.load(library);
  assert.equal(calls, 1);
});
test("forced refresh reaches the server; failed refresh preserves last data for display", async () => {
  let fail = false,
    calls = 0;
  const cache = new DataCache(async <T>() => {
    calls++;
    if (fail) throw Error("offline");
    return { n: calls } as T;
  });
  await cache.load(library);
  await cache.load(library, true);
  assert.deepEqual(cache.get(library), { n: 2 });
  fail = true;
  await assert.rejects(cache.load(library, true), /offline/);
  assert.deepEqual(cache.get(library), { n: 2 });
});
test("a late pre-mutation GET cannot replace the saved result", async () => {
  let release!: (value: unknown) => void;
  const cache = new DataCache(<T>(_path: string, init?: RequestInit) =>
    init?.method
      ? Promise.resolve({ ok: true } as T)
      : (new Promise<unknown>((resolve) => {
          release = resolve;
        }) as Promise<T>),
  );
  const old = cache.load(library);
  await cache.request("/api/user-shows/1", { method: "POST" });
  cache.set(library, { watched: true });
  release({ watched: false });
  await old;
  assert.deepEqual(cache.get(library), { watched: true });
});
test("friend mutations refresh social data without discarding the library", async () => {
  const cache = new DataCache(async <T>() => ({ ok: true }) as T);
  cache.set(library, []);
  cache.set("/api/friendships", {});
  cache.set("/api/users/alice", {});
  await cache.request("/api/friendships", { method: "POST" });
  assert.equal(cache.fresh(library), true);
  assert.equal(cache.fresh("/api/friendships"), false);
  assert.equal(cache.fresh("/api/users/alice"), false);
});
test("failed uncertain writes also invalidate affected reads", async () => {
  const cache = new DataCache(async () => {
    throw Error("lost response");
  });
  cache.set(library, []);
  await assert.rejects(cache.request("/api/user-shows/1", { method: "POST" }));
  assert.equal(cache.fresh(library), false);
});
test("each login has isolated data and pending requests", async () => {
  const first = new DataCache(async <T>() => ["Alice"] as T);
  const second = new DataCache(async <T>() => ["Bob"] as T);
  await first.load(library);
  assert.equal(second.get(library), null);
  await second.load(library);
  assert.deepEqual(first.get(library), ["Alice"]);
  assert.deepEqual(second.get(library), ["Bob"]);
});
test("expired data refreshes and cache size stays bounded", async () => {
  let calls = 0;
  const cache = new DataCache(async <T>() => ++calls as T);
  cache.set(library, 0, false);
  await cache.load(library);
  assert.equal(cache.get(library), 1);
  for (let i = 0; i < 61; i++) cache.set(`/api/users/${i}`, i);
  assert.equal(cache.get(library), null);
  assert.equal(cache.get("/api/users/0"), null);
  assert.equal(cache.get("/api/users/60"), 60);
});
