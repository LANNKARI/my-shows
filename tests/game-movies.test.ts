import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleGameMovie,
  isAnimeMovie,
  gameMoviePool,
} from "../src/lib/game-movies";
const movie = (id: number) => ({
  id,
  title: `Фильм ${id}`,
  backdrop_path: `/frame${id}.jpg`,
  genre_ids: [18],
  original_language: "en",
  release_date: "2020-01-01",
});
test("anime is excluded while Japanese live action and Western animation remain", () => {
  assert.equal(
    isAnimeMovie({ genre_ids: [16], original_language: "ja" }),
    true,
  );
  assert.equal(
    isAnimeMovie({
      genre_ids: [16],
      original_language: "en",
      origin_country: ["JP"],
    }),
    true,
  );
  assert.equal(
    isAnimeMovie({ genre_ids: [18], original_language: "ja" }),
    false,
  );
  assert.equal(eligibleGameMovie({ ...movie(1), genre_ids: [16] }), true);
  for (const change of [
    { adult: true },
    { release_date: "2099-01-01" },
    { backdrop_path: null },
    { title: "No translation" },
    { id: -1 },
    { genre_ids: [16], original_language: "ja" },
  ])
    assert.equal(eligibleGameMovie({ ...movie(1), ...change }), false);
});
test("catalog filters history, anime and duplicate titles across pages and tolerates one failed source", async () => {
  const calls: URL[] = [];
  const fetcher = (async (url: URL) => {
    calls.push(url);
    if (calls.length === 1) return new Response("", { status: 503 });
    return Response.json({
      results: [
        ...Array.from({ length: 20 }, (_, i) => movie(i + 1)),
        { ...movie(99), title: " ФИЛЬМ 2 " },
        { ...movie(100), genre_ids: [16], original_language: "ja" },
      ],
    });
  }) as typeof fetch;
  const pool = await gameMoviePool({
    apiKey: "fixture",
    fetcher,
    excluded: new Set([1]),
    minimum: 12,
  });
  assert.equal(pool.length, 19);
  assert.ok(!pool.some((m) => [1, 99, 100].includes(m.id)));
  assert.equal(
    new Set(
      calls.map(
        (u) => `${u.searchParams.get("page")}:${u.searchParams.get("sort_by")}`,
      ),
    ).size,
    4,
  );
  assert.ok(
    calls.every((u) => u.searchParams.get("include_adult") === "false"),
  );
});
test("catalog never falls back to excluded movies when exhausted", async () => {
  let calls = 0;
  await assert.rejects(
    gameMoviePool({
      apiKey: "fixture",
      excluded: new Set([1]),
      fetcher: (async () => {
        calls++;
        return Response.json({ results: [movie(1)] });
      }) as typeof fetch,
    }),
  );
  assert.equal(calls, 12);
});
