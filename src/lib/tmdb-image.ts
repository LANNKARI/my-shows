// Public Cloudinary product environment; no API credentials are needed for Fetch.
const CLOUD_NAME = "lz6hvjwd";
const TMDB_IMAGE = /^https:\/\/image\.tmdb\.org\/t\/p\/(?:w\d+|h\d+|original)\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;

/** Route only TMDB images through Cloudinary, preserving existing source sizes.
 * Other images (uploads, local assets, data URLs) retain their original address.
 * Keep this at the presentation boundary: database and import URLs stay intact.
 */
export function tmdbImageUrl<T extends string | null | undefined>(source: T): T {
  if (!source || !TMDB_IMAGE.test(source)) return source;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/f_auto,q_auto/${source}` as T;
}
