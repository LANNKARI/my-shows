import {
  actorCreditKey,
  type ActorCredit,
  type ActorDetails,
} from "./actor-types";
export class ActorError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function actorId(value: string) {
  const id = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  )
    throw new ActorError(400, "Некорректный номер актёра");
  return id;
}
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const date = (value: unknown) => {
  const day = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(day);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day
    ? day
    : null;
};
const picture = (value: unknown, size: string) =>
  typeof value === "string" && /^\/[a-zA-Z0-9._-]+$/.test(value)
    ? `https://image.tmdb.org/t/p/${size}${value}`
    : null;
type Raw = Record<string, unknown>;
const object = (value: unknown): value is Raw =>
  !!value && typeof value === "object" && !Array.isArray(value);
// TMDB's movie/tv media type also includes broadcasts and award ceremonies.
const programmeGenres = new Set([10763, 10764, 10767]); // News, Reality, Talk.
const appearanceRole =
  /^(?:self|himself|herself|themselves|host|co-host|presenter|guest|самого себя|саму себя|сам себя|сама себя|в роли себя|ведущий|ведущая|соведущий|соведущая)(?=$|[\s(/,:–—-])/iu;
function programmeAppearance(item: Raw) {
  if (
    item.media_type === "tv" &&
    Array.isArray(item.genre_ids) &&
    item.genre_ids.some((id) => programmeGenres.has(id))
  )
    return true;
  return appearanceRole.test(text(item.character));
}
export function actorCredits(raw: unknown): ActorCredit[] {
  if (!Array.isArray(raw))
    throw new ActorError(503, "Фильмография временно недоступна");
  const unique = new Map<string, ActorCredit>();
  for (const item of raw) {
    if (
      !object(item) ||
      item.adult === true ||
      !Number.isSafeInteger(item.id) ||
      Number(item.id) <= 0 ||
      Number(item.id) > 2147483647 ||
      !["movie", "tv"].includes(String(item.media_type)) ||
      programmeAppearance(item)
    )
      continue;
    const kind = item.media_type === "movie" ? "movie" : "series";
    const title =
      text(kind === "movie" ? item.title : item.name) ||
      text(kind === "movie" ? item.original_title : item.original_name);
    if (!title) continue;
    const releaseDate = date(
      kind === "movie" ? item.release_date : item.first_air_date,
    );
    const role = text(item.character);
    const credit: ActorCredit = {
      id: Number(item.id),
      kind,
      title,
      releaseDate,
      year: releaseDate?.slice(0, 4) ?? null,
      posterUrl: picture(item.poster_path, "w500"),
      roles: role ? [role] : [],
      popularity:
        typeof item.popularity === "number" && Number.isFinite(item.popularity)
          ? item.popularity
          : 0,
      rating:
        typeof item.vote_average === "number" &&
        item.vote_average > 0 &&
        item.vote_average <= 10 &&
        Number(item.vote_count) > 0
          ? Math.round(item.vote_average * 10) / 10
          : null,
    };
    const key = actorCreditKey(credit),
      previous = unique.get(key);
    if (previous) {
      previous.roles = [...new Set([...previous.roles, ...credit.roles])];
      previous.posterUrl ||= credit.posterUrl;
      previous.releaseDate ||= credit.releaseDate;
      previous.year ||= credit.year;
      previous.popularity = Math.max(previous.popularity, credit.popularity);
    } else unique.set(key, credit);
  }
  return [...unique.values()].sort(
    (a, b) =>
      b.popularity - a.popularity || a.title.localeCompare(b.title, "ru"),
  );
}
export async function loadActor(
  id: number,
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<ActorDetails> {
  const key =
    options.apiKey ??
    (process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY);
  if (!key) throw new ActorError(503, "Сведения об актёре временно недоступны");
  const fetcher = options.fetcher ?? fetch;
  async function read(language: string, credits = false) {
    const url = new URL(`https://api.themoviedb.org/3/person/${id}`);
    url.searchParams.set("language", language);
    if (credits) url.searchParams.set("append_to_response", "combined_credits");
    if (!key!.startsWith("eyJ")) url.searchParams.set("api_key", key!);
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: key!.startsWith("eyJ")
          ? { Authorization: `Bearer ${key}` }
          : {},
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 21600 },
      });
    } catch {
      throw new ActorError(
        503,
        "Не удалось загрузить сведения об актёре. Попробуйте ещё раз.",
      );
    }
    if (response.status === 404) throw new ActorError(404, "Актёр не найден");
    if (!response.ok)
      throw new ActorError(503, "Сведения об актёре временно недоступны");
    const data: unknown = await response.json().catch(() => null);
    if (!object(data) || data.id !== id || !text(data.name))
      throw new ActorError(503, "Не удалось прочитать сведения об актёре");
    return data;
  }
  const data = await read("ru-RU", true);
  const credits = object(data.combined_credits)
    ? actorCredits(data.combined_credits.cast)
    : (() => {
        throw new ActorError(503, "Фильмография временно недоступна");
      })();
  let biography = text(data.biography),
    language: ActorDetails["biographyLanguage"] = biography ? "ru" : null,
    originalName: string | null = null;
  if (!biography) {
    try {
      const english = await read("en-US");
      biography = text(english.biography);
      language = biography ? "en" : null;
      originalName = text(english.name) || null;
    } catch {
      /* A missing translation must not hide the available profile and credits. */
    }
  }
  return {
    id,
    name: text(data.name),
    originalName: originalName !== text(data.name) ? originalName : null,
    biography,
    biographyLanguage: language,
    profileUrl: picture(data.profile_path, "w500"),
    birthday: date(data.birthday),
    deathday: date(data.deathday),
    birthplace: text(data.place_of_birth) || null,
    credits,
  };
}
