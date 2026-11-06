import { tmdbImageUrl } from "./tmdb-image";

/** Prepare the exact displayed URLs before committing a new card/round. */
export async function prepareImages(
  sources: (string | null | undefined)[],
  signal?: AbortSignal,
): Promise<void> {
  await Promise.all([...new Set(sources.filter((src): src is string => !!src))].map(source =>
    new Promise<void>((resolve, reject) => {
      const image = new Image();
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        image.onload = image.onerror = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(signal?.reason || new DOMException("Aborted", "AbortError"));
      const timer = setTimeout(() => finish(new Error("Изображение не загрузилось. Попробуйте ещё раз.")), 15000);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      image.onload = () => {
        image.decode().then(() => finish(), () => finish(new Error("Не удалось подготовить изображение. Попробуйте ещё раз.")));
      };
      image.onerror = () => finish(new Error("Изображение не загрузилось. Попробуйте ещё раз."));
      image.src = tmdbImageUrl(source);
    }),
  ));
}
