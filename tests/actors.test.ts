import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actorCredits,
  actorId,
  ActorError,
  loadActor,
} from "../src/lib/actors";

test("actor IDs reject ambiguous and unsafe inputs", () => {
  for (const id of ["0", "-1", "1e3", "1/2", "99999999999999999", "1abc"])
    assert.throws(() => actorId(id), ActorError);
  assert.equal(actorId("123"), 123);
});
test("credits deduplicate roles while preserving different media with the same number", () => {
  const base = {
    id: 10,
    media_type: "movie",
    title: "Фильм",
    release_date: "2020-02-03",
    character: "Роль",
    popularity: 5,
    vote_average: 8,
    vote_count: 4,
    poster_path: "/a.jpg",
  };
  const result = actorCredits([
    base,
    { ...base, character: "Другая роль" },
    { ...base, media_type: "tv", name: "Сериал", first_air_date: "2021-03-04" },
    { ...base, id: 11, adult: true },
    { ...base, id: 12, media_type: "person" },
    { ...base, id: 13, title: "", original_title: "" },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.find((c) => c.kind === "movie")?.roles, [
    "Роль",
    "Другая роль",
  ]);
  assert.equal(result.find((c) => c.kind === "series")?.year, "2021");
  assert.equal(result[0].rating, 8);
});
test("missing photos and dates are optional and unsafe paths are not rendered", () => {
  const [credit] = actorCredits([
    {
      id: 1,
      media_type: "movie",
      title: "Без данных",
      poster_path: "//other.test/a",
      release_date: "2020-02-31",
      vote_average: 9,
      vote_count: 0,
    },
  ]);
  assert.equal(credit.posterUrl, null);
  assert.equal(credit.releaseDate, null);
  assert.equal(credit.rating, null);
});
const person = {
  id: 123,
  name: "Имя",
  biography: "Русская биография",
  profile_path: "/person.jpg",
  combined_credits: { cast: [] },
};
test("Russian biography uses a cached bounded request without sending the API key to the client", async () => {
  let calls = 0;
  const actor = await loadActor(123, {
    apiKey: "eyJ.test",
    fetcher: async (url, init) => {
      calls++;
      assert.equal(
        new URL(String(url)).searchParams.get("append_to_response"),
        "combined_credits",
      );
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer eyJ.test",
      );
      assert.ok(init?.signal);
      return Response.json(person);
    },
  });
  assert.equal(calls, 1);
  assert.equal(actor.biographyLanguage, "ru");
  assert.equal(actor.profileUrl, "https://image.tmdb.org/t/p/w500/person.jpg");
  assert.equal(JSON.stringify(actor).includes("eyJ.test"), false);
});
test("empty Russian bio falls back to English and preserves the Russian name", async () => {
  const actor = await loadActor(123, {
    apiKey: "fixture",
    fetcher: async (url) =>
      Response.json(
        new URL(String(url)).searchParams.get("language") === "ru-RU"
          ? { ...person, biography: "" }
          : { ...person, name: "Name", biography: "English bio" },
      ),
  });
  assert.equal(actor.name, "Имя");
  assert.equal(actor.originalName, "Name");
  assert.equal(actor.biographyLanguage, "en");
});
test("failed translation preserves the profile while 404 and invalid filmography remain explicit failures", async () => {
  const actor = await loadActor(123, {
    apiKey: "fixture",
    fetcher: async (url) =>
      new URL(String(url)).searchParams.get("language") === "ru-RU"
        ? Response.json({ ...person, biography: "" })
        : new Response("", { status: 503 }),
  });
  assert.equal(actor.biography, "");
  assert.equal(actor.biographyLanguage, null);
  await assert.rejects(
    loadActor(123, {
      apiKey: "fixture",
      fetcher: async () => new Response("", { status: 404 }),
    }),
    (error: unknown) => error instanceof ActorError && error.status === 404,
  );
  await assert.rejects(
    loadActor(123, {
      apiKey: "fixture",
      fetcher: async () => Response.json({ ...person, combined_credits: {} }),
    }),
    ActorError,
  );
  await assert.rejects(
    loadActor(123, {
      apiKey: "fixture",
      fetcher: async () => {
        throw Error("offline");
      },
    }),
    ActorError,
  );
});
