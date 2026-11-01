import { randomInt } from "node:crypto";
export type GameMovie = {
  id: number;
  title: string;
  backdrop_path: string;
  poster_path?: string;
  genre_ids: number[];
  original_language: string;
  origin_country?: string[];
  release_date: string;
  adult?: boolean;
};
export function isAnimeMovie(movie: {
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
}) {
  return (
    !!movie.genre_ids?.includes(16) &&
    (movie.original_language === "ja" || !!movie.origin_country?.includes("JP"))
  );
}
const imagePath = (value: unknown): value is string =>
  typeof value === "string" && /^\/[a-zA-Z0-9._-]+$/.test(value);
export function eligibleGameMovie(
  raw: unknown,
  today = new Date().toISOString().slice(0, 10),
): raw is GameMovie {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as GameMovie;
  return (
    Number.isSafeInteger(m.id) &&
    m.id > 0 &&
    typeof m.title === "string" &&
    /[а-яА-ЯёЁ]/.test(m.title) &&
    m.title.length <= 500 &&
    imagePath(m.backdrop_path) &&
    Array.isArray(m.genre_ids) &&
    m.genre_ids.every((n) => Number.isInteger(n)) &&
    typeof m.original_language === "string" &&
    !isAnimeMovie(m) &&
    m.adult !== true &&
    typeof m.release_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(m.release_date) &&
    m.release_date <= today
  );
}
export const movieTitleKey = (title: string) =>
  title.normalize("NFKC").trim().toLocaleLowerCase("ru");
export const movieImageKey = (url: string) => url.split("/").at(-1) || url;
export async function gameMoviePool(
  options: {
    apiKey?: string;
    fetcher?: typeof fetch;
    excluded?: Set<number>;
    minimum?: number;
    now?: Date;
  } = {},
) {
  const key =
    options.apiKey ??
    (process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY);
  if (!key) throw Error("Подбор фильмов временно недоступен");
  const fetcher = options.fetcher ?? fetch,
    deadline = AbortSignal.timeout(12000),
    now = options.now ?? new Date();
  const movies = new Map<number, GameMovie>(),
    tried = new Set<string>();
  for (let batch = 0; batch < 3 && !deadline.aborted; batch++) {
    const selections: Array<{ sort: string; page: number }> = [];
    while (selections.length < 4) {
      const sort =
          selections.length % 2 ? "vote_count.desc" : "popularity.desc",
        page = randomInt(1, 41),
        id = `${sort}:${page}`;
      if (tried.has(id)) continue;
      tried.add(id);
      selections.push({ sort, page });
    }
    const results = await Promise.allSettled(
      selections.map(async ({ sort, page }) => {
        const url = new URL("https://api.themoviedb.org/3/discover/movie");
        url.search = new URLSearchParams({
          language: "ru-RU",
          sort_by: sort,
          page: String(page),
          include_adult: "false",
          "vote_count.gte": "500",
          "primary_release_date.lte": now.toISOString().slice(0, 10),
        }).toString();
        if (!key.startsWith("eyJ")) url.searchParams.set("api_key", key);
        const response = await fetcher(url, {
          headers: key.startsWith("eyJ")
            ? { Authorization: `Bearer ${key}` }
            : {},
          next: { revalidate: 3600 },
          signal: AbortSignal.any([deadline, AbortSignal.timeout(6000)]),
        });
        if (!response.ok) throw Error("Movie source unavailable");
        const data = await response.json();
        if (!Array.isArray(data.results)) throw Error("Invalid movie source");
        return data.results as unknown[];
      }),
    );
    for (const result of results)
      if (result.status === "fulfilled")
        for (const movie of result.value)
          if (
            eligibleGameMovie(movie, now.toISOString().slice(0, 10)) &&
            !options.excluded?.has(movie.id)
          )
            movies.set(movie.id, movie);
    const titles = new Set<string>();
    const unique = [...movies.values()].filter((movie) => {
      const title = movieTitleKey(movie.title);
      if (titles.has(title)) return false;
      titles.add(title);
      return true;
    });
    if (unique.length >= (options.minimum ?? 4)) return unique;
  }
  throw Error(
    "Недостаточно новых фильмов. Попробуйте позже — повторные кадры не выдаются.",
  );
}
