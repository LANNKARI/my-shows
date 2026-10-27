import { CalendarError } from "./calendar-server";
import type { BackupTitle } from "./library-backup";
export async function verifiedImportCatalog(
  title: Pick<BackupTitle, "kind" | "tmdbId" | "episodes">,
  fetcher: typeof fetch = fetch,
) {
  if (!title.tmdbId) throw new CalendarError(400, "Нет внешнего ID");
  const key =
    process.env.TMDB_API_KEY ||
    process.env.TMDB_READ_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!key)
    throw new CalendarError(
      503,
      "Для новых карточек и недостающих серий требуется доступный TMDB API key. Уже известные тайтлы можно импортировать без запроса к TMDB.",
    );
  const url = new URL(
    `https://api.themoviedb.org/3/${title.kind === "movie" ? "movie" : "tv"}/${title.tmdbId}`,
  );
  url.searchParams.set("language", "ru-RU");
  if (!key.startsWith("eyJ")) url.searchParams.set("api_key", key);
  const response = await fetcher(url, {
    headers: key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 3600 },
  });
  if (response.status === 404)
    throw new CalendarError(400, "TMDB не нашёл указанную карточку");
  if (!response.ok)
    throw new CalendarError(
      503,
      "TMDB временно недоступен, повторите импорт позже",
    );
  const data = await response.json();
  if (data.id !== title.tmdbId || typeof (data.title || data.name) !== "string")
    throw new CalendarError(503, "Некорректный ответ TMDB");
  const seasons = new Map<number, number>(
    (Array.isArray(data.seasons) ? data.seasons : [])
      .filter(
        (s: { season_number: number; episode_count: number }) =>
          Number.isSafeInteger(s.season_number) &&
          Number.isSafeInteger(s.episode_count),
      )
      .map((s: { season_number: number; episode_count: number }) => [
        s.season_number,
        s.episode_count,
      ]),
  );
  if (
    title.episodes.some((e) =>
      title.kind === "movie"
        ? e.season !== 1 || e.episode !== 1
        : e.episode < 1 || e.episode > (seasons.get(e.season) || 0),
    )
  )
    throw new CalendarError(
      400,
      "В бэкапе есть серии, которых нет в подтверждённом каталоге TMDB",
    );
  const runtime =
    title.kind === "movie"
      ? data.runtime
      : Array.isArray(data.episode_run_time)
        ? data.episode_run_time[0]
        : null;
  return {
    name: String(data.title || data.name).slice(0, 500),
    originalName:
      typeof (data.original_title || data.original_name) === "string"
        ? String(data.original_title || data.original_name).slice(0, 500)
        : null,
    posterUrl:
      typeof data.poster_path === "string" &&
      /^\/[a-zA-Z0-9._-]+$/.test(data.poster_path)
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : null,
    year:
      typeof (data.release_date || data.first_air_date) === "string"
        ? String(data.release_date || data.first_air_date).slice(0, 4)
        : null,
    runtime:
      Number.isInteger(runtime) && runtime > 0 && runtime < 10000
        ? runtime
        : null,
    genres: (Array.isArray(data.genres) ? data.genres : [])
      .filter((g: { name: string }) => typeof g?.name === "string")
      .slice(0, 50)
      .map((g: { name: string }) => g.name.slice(0, 100)) as string[],
  };
}
