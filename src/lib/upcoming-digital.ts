export type DigitalPremiere = { id: number; kind: "movie" | "series"; title: string; date: string; country: string | null; platform: string | null; imageUrl: string };
type ReleaseCountry = { iso_3166_1?: string; release_dates?: { type?: number; release_date?: string }[] };
type Movie = { id: number; title?: string; name?: string; adult?: boolean; backdrop_path?: string | null; poster_path?: string | null };
type SeriesDetails = Movie & { first_air_date?: string; networks?: { name?: string }[] };
export function validReleaseDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function firstDigitalRelease(results: ReleaseCountry[], today: string, until: string) {
  const entries = results.flatMap(country => (country.release_dates || []).filter(release => release.type === 4).flatMap(release => {
    const date = release.release_date?.slice(0, 10);
    return validReleaseDay(date) ? [{ date, country: /^[A-Z]{2}$/.test(country.iso_3166_1 || "") ? country.iso_3166_1! : "XX" }] : [];
  }));
  const priority = (country: string) => country === "RU" ? 0 : country === "US" ? 1 : country === "GB" ? 2 : 3;
  entries.sort((a, b) => a.date.localeCompare(b.date) || priority(a.country) - priority(b.country) || a.country.localeCompare(b.country));
  const first = entries[0];
  // A later subscription release must not bring an already-digital movie back.
  return first && first.date >= today && first.date <= until ? first : null;
}
const streamingNetwork = /^(Netflix|Amazon Prime Video|Prime Video|Disney\+|Hulu|Apple TV\+?|Max|HBO Max|Paramount\+|Peacock|Кинопоиск|Иви|Okko|START|Wink|KION|Premier)$/i;
export function streamingSeries(details: SeriesDetails, today: string, until: string) {
  const date = details.first_air_date, networks = details.networks || [];
  if (!validReleaseDay(date) || date < today || date > until || !networks.length || !networks.every(network => streamingNetwork.test(network.name || ""))) return null;
  return { date, platform: [...new Set(networks.map(network => network.name!))].join(" / ") };
}
const image = (item: Movie) => {
  const path = item.backdrop_path || item.poster_path;
  return typeof path === "string" && /^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(path) ? `https://image.tmdb.org/t/p/${item.backdrop_path ? "w780" : "w500"}${path}` : null;
};
export async function upcomingDigital(options: { apiKey?: string; fetcher?: typeof fetch; now?: Date } = {}) {
  const apiKey = options.apiKey ?? (process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN || process.env.NEXT_PUBLIC_TMDB_API_KEY);
  if (!apiKey) throw Error("TMDB unavailable");
  const fetcher = options.fetcher || fetch, now = options.now || new Date();
  const today = now.toISOString().slice(0, 10), until = new Date(Date.parse(today) + 90 * 86400000).toISOString().slice(0, 10);
  const budget = AbortSignal.timeout(18000), bearer = apiKey.startsWith("eyJ");
  async function request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
    if (budget.aborted) return null;
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`); url.searchParams.set("language", "ru-RU");
    if (!bearer) url.searchParams.set("api_key", apiKey!);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    try {
      const response = await fetcher(url, { headers: bearer ? { Authorization: `Bearer ${apiKey}` } : {}, next: { revalidate: 3600 }, signal: AbortSignal.any([budget, AbortSignal.timeout(6000)]) });
      return response.ok ? await response.json() as T : null;
    } catch { return null; }
  }
  const movieParams = { "release_date.gte": today, "release_date.lte": until, with_release_type: 4, sort_by: "popularity.desc", include_adult: "false", include_video: "false" };
  const pages = await Promise.all([
    request<{ results?: Movie[] }>("discover/movie", { ...movieParams, page: 1 }),
    request<{ results?: Movie[] }>("discover/movie", { ...movieParams, page: 2 }),
    request<{ results?: Movie[] }>("discover/tv", { "first_air_date.gte": today, "first_air_date.lte": until, sort_by: "popularity.desc", include_adult: "false", page: 1 }),
  ]);
  if (pages.every(page => !page)) throw Error("TMDB unavailable");
  const eligible = (item: Movie) => Number.isSafeInteger(item.id) && item.id > 0 && !item.adult && !!image(item);
  const movies = [...new Map(pages.slice(0, 2).flatMap(page => page?.results || []).filter(eligible).map(item => [item.id, item])).values()].slice(0, 24);
  const series = [...new Map((pages[2]?.results || []).filter(eligible).map(item => [item.id, item])).values()].slice(0, 8);
  const candidates = [...movies.map(item => ({ item, kind: "movie" as const })), ...series.map(item => ({ item, kind: "series" as const }))];
  let index = 0, verified = 0;
  const items: DigitalPremiere[] = [];
  await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, async () => {
    while (index < candidates.length && !budget.aborted) {
      const { item, kind } = candidates[index++];
      if (kind === "movie") {
        const dates = await request<{ results?: ReleaseCountry[] }>(`movie/${item.id}/release_dates`);
        if (!dates || !Array.isArray(dates.results)) continue;
        verified++;
        const release = firstDigitalRelease(dates.results, today, until);
        if (release) items.push({ id: item.id, kind, title: item.title || item.name || "Без названия", ...release, platform: null, imageUrl: image(item)! });
      } else {
        const details = await request<SeriesDetails>(`tv/${item.id}`);
        if (!details) continue;
        verified++;
        const release = streamingSeries(details, today, until);
        if (release && !details.adult) items.push({ id: item.id, kind, title: details.name || item.name || "Без названия", ...release, country: null, imageUrl: image(details) || image(item)! });
      }
    }
  }));
  if (candidates.length && !verified) throw Error("TMDB unavailable");
  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ru") || a.id - b.id);
  return { items: items.slice(0, 24), checkedAt: now.toISOString() };
}
