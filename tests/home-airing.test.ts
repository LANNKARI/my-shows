import { test } from "node:test";
import assert from "node:assert/strict";
import { airingWindow, isCurrentlyAiring } from "../src/lib/home-airing";
const now = new Date("2026-11-01T23:59:59Z");
const active = {
  status: "Returning Series",
  in_production: true,
  first_air_date: "2005-09-22",
  last_episode_to_air: { air_date: "2026-10-29" },
  next_episode_to_air: { air_date: "2026-11-05" },
};
test("a long-running series must have a current season, regardless of its premiere year", () => {
  assert.equal(isCurrentlyAiring(active, now), true);
  for (const status of ["Ended", "Canceled", "Planned", "In Production"])
    assert.equal(isCurrentlyAiring({ ...active, status }, now), false);
  assert.equal(
    isCurrentlyAiring({ ...active, in_production: false }, now),
    false,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2025-11-01" },
        next_episode_to_air: null,
      },
      now,
    ),
    false,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2026-01-01" },
        next_episode_to_air: { air_date: "2027-01-01" },
      },
      now,
    ),
    false,
  );
});
test("missing, malformed and unaired schedules never become active fallbacks", () => {
  assert.equal(isCurrentlyAiring(null, now), false);
  assert.equal(isCurrentlyAiring({}, now), false);
  assert.equal(
    isCurrentlyAiring({ ...active, first_air_date: "2026-11-02" }, now),
    false,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2026-10-32" },
        next_episode_to_air: null,
      },
      now,
    ),
    false,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2026-11-02" },
        next_episode_to_air: null,
      },
      now,
    ),
    false,
  );
});
test("episode windows use UTC and include both 14-day boundaries", () => {
  assert.deepEqual(airingWindow(now), {
    today: "2026-11-01",
    from: "2026-10-18",
    to: "2026-11-15",
  });
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2026-10-18" },
        next_episode_to_air: null,
      },
      now,
    ),
    true,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: null,
        next_episode_to_air: { air_date: "2026-11-15" },
      },
      now,
    ),
    true,
  );
  assert.equal(
    isCurrentlyAiring(
      {
        ...active,
        last_episode_to_air: { air_date: "2026-10-17" },
        next_episode_to_air: { air_date: "2026-11-16" },
      },
      now,
    ),
    false,
  );
});

test("home API checks trending schedules, deduplicates series details and fails closed on missing details", async () => {
  const { GET } = await import("../src/app/api/home/route");
  const { NextRequest } = await import("next/server");
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const base = {
    name: "Тестовый сериал",
    vote_average: 8.5,
    vote_count: 1000,
    backdrop_path: "/frame.jpg",
    poster_path: "/poster.jpg",
    overview: "Описание",
    original_language: "en",
    genre_ids: [18],
    first_air_date: "2005-01-01",
  };
  const today = new Date().toISOString().slice(0, 10);
  try {
    globalThis.fetch = (async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      const id = Number(url.pathname.split("/").at(-1));
      if (url.pathname.includes("/tv/") && Number.isInteger(id)) {
        if (id === 3) return new Response("", { status: 503 });
        return Response.json({
          ...active,
          id,
          last_episode_to_air: { air_date: today },
          next_episode_to_air: null,
          ...(id === 2 ? { status: "Ended", in_production: false } : {}),
        });
      }
      if (url.pathname.endsWith("/trending/all/week"))
        return Response.json({
          results: [1, 2, 3].map((id) => ({ ...base, id, media_type: "tv" })),
        });
      if (url.pathname.endsWith("/discover/tv"))
        return Response.json({
          results: [1, 2, 3].map((id) => ({ ...base, id })),
        });
      return Response.json({ results: [] });
    }) as typeof fetch;
    const response = await GET(new NextRequest("http://localhost/api/home"));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(
      result.heroSlides.map((m: { id: number }) => m.id),
      [1],
    );
    assert.equal(calls.filter((path) => path.endsWith("/tv/1")).length, 1);
    assert.equal(calls.filter((path) => path.endsWith("/tv/2")).length, 1);
    assert.equal(calls.filter((path) => path.endsWith("/tv/3")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
