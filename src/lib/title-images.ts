export type TitleImage = {
  thumbnail: string;
  original: string;
  width: number;
  height: number;
};
const imagePath = /^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;
export async function titleImages(
  id: number,
  kind: string,
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<TitleImage[]> {
  const key =
    options.apiKey ??
    (process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY);
  if (!key) throw Error("TMDB unavailable");
  const url = new URL(
    `https://api.themoviedb.org/3/${kind === "movie" ? "movie" : "tv"}/${id}/images`,
  );
  url.searchParams.set("include_image_language", "ru,en,null");
  if (!key.startsWith("eyJ")) url.searchParams.set("api_key", key);
  const response = await (options.fetcher || fetch)(url, {
    headers: key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {},
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw Error("TMDB unavailable");
  const data = await response.json();
  if (!Array.isArray(data.backdrops)) throw Error("Invalid images");
  const seen = new Set<string>();
  return data.backdrops
    .filter(
      (item: { file_path?: string }) =>
        typeof item.file_path === "string" &&
        imagePath.test(item.file_path) &&
        !seen.has(item.file_path) &&
        !!seen.add(item.file_path),
    )
    .slice(0, 24)
    .map((item: { file_path: string; width?: number; height?: number }) => ({
      thumbnail: `https://image.tmdb.org/t/p/w780${item.file_path}`,
      original: `https://image.tmdb.org/t/p/original${item.file_path}`,
      width: Number.isFinite(item.width) ? item.width! : 0,
      height: Number.isFinite(item.height) ? item.height! : 0,
    }));
}
