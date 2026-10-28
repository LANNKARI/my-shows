import { createHash } from "node:crypto";
import { CalendarError } from "./calendar-server";
export type BackupEpisode = {
  season: number;
  episode: number;
  name: string | null;
  airDate: string | null;
};
export type BackupTitle = {
  sourceId: number;
  kind: "movie" | "series";
  tmdbId: number | null;
  name: string;
  originalName: string | null;
  posterUrl: string | null;
  year: string | null;
  genres: string[];
  runtime: number | null;
  status: string;
  isFavorite: boolean;
  totalSeasons: number;
  totalEpisodes: number;
  dubbing: string | null;
  watchSite: string | null;
  note: string;
  episodes: BackupEpisode[];
  progress: {
    season: number;
    episode: number;
    watched: boolean;
    stoppedAt: string | null;
    watchedAt: string | null;
  }[];
  ratings: {
    season: number | null;
    episode: number | null;
    score: number;
    createdAt: string | null;
  }[];
};
export type BackupCollection = { name: string; showIds: number[] };
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Ожидался объект");
  return v as Obj;
};
const array = (v: unknown, max: number) => {
  if (!Array.isArray(v) || v.length > max)
    throw new Error("Некорректный список или слишком много записей");
  return v;
};
const str = (v: unknown, max: number, nullable = false): string | null => {
  if (nullable && (v === null || v === undefined || v === "")) return null;
  if (typeof v !== "string" || v.length > max)
    throw new Error("Некорректный текст");
  return v;
};
const num = (v: unknown, max = 1000000000, min = 0) => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw new Error("Некорректное число");
  return v;
};
const date = (v: unknown) => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || v.length > 40 || !Number.isFinite(Date.parse(v)))
    throw new Error("Некорректная дата");
  return new Date(v).toISOString();
};
export const statuses = ["watching", "planned", "completed", "dropped"];
export function parseBackup(raw: unknown, legacyStatus?: unknown) {
  try {
    const root = obj(raw),
      meta = obj(root.meta);
    if (
      meta.generator !== "EpisyHub" ||
      ![1, 2].includes(meta.version as number)
    )
      throw new Error("Поддерживаются бэкапы EpisyHub версий 1 и 2");
    const legacy = meta.version === 1;
    if (
      legacyStatus !== undefined &&
      legacyStatus !== "" &&
      !statuses.includes(legacyStatus as string)
    )
      throw new Error("Некорректный статус для старого бэкапа");
    let episodeCount = 0;
    const warnings: string[] = [];
    const titles = array(root.userShows, 500).map((value, index) => {
      const row = obj(value),
        show = obj(row.show),
        settings = obj(row.settings);
      const kind = show.kind;
      if (kind !== "movie" && kind !== "series")
        throw new Error(`Тайтл ${index + 1}: неизвестный тип`);
      let status = legacy
        ? settings.isCompleted === true
          ? "completed"
          : legacyStatus
        : row.status;
      if (!statuses.includes(status as string)) {
        status = "";
        warnings.push(`Тайтл ${index + 1}: выберите статус для старого бэкапа`);
      }
      const progress = array(row.progress || [], 5000).map((v) => {
        const p = obj(v);
        const stoppedAt = str(p.stoppedAt, 12, true);
        if (stoppedAt && !/^\d{1,3}:(?:[0-5]\d:)?[0-5]\d$/.test(stoppedAt))
          throw new Error("Некорректное сохранённое время");
        if (typeof p.watched !== "boolean")
          throw new Error("Некорректная отметка просмотра");
        return {
          season: num(p.season, 1000),
          episode: num(p.episode, 10000),
          watched: p.watched,
          stoppedAt,
          watchedAt: date(p.watchedAt),
        };
      });
      const episodes: BackupEpisode[] = legacy
        ? progress.map((p) => ({
            season: p.season,
            episode: p.episode,
            name: null,
            airDate: null,
          }))
        : array(row.episodes || [], 5000).map((v) => {
            const e = obj(v);
            return {
              season: num(e.season, 1000),
              episode: num(e.episode, 10000),
              name: str(e.name, 500, true),
              airDate: date(e.airDate),
            };
          });
      if (kind === "movie" && !episodes.length)
        episodes.push({ season: 1, episode: 1, name: null, airDate: null });
      const unique = new Set(episodes.map((e) => `${e.season}:${e.episode}`));
      if (
        unique.size !== episodes.length ||
        new Set(progress.map((e) => `${e.season}:${e.episode}`)).size !==
          progress.length
      )
        throw new Error("Повторные эпизоды в файле");
      if (progress.some((p) => !unique.has(`${p.season}:${p.episode}`)))
        throw new Error("Прогресс ссылается на отсутствующий эпизод");
      episodeCount += episodes.length;
      if (episodeCount > 20000)
        throw new Error("Максимум 20 000 эпизодов на файл");
      const ratings = array(row.ratings || [], 5001).flatMap((v) => {
        const r = obj(v);
        if (legacy && r.episodeId !== null) {
          return [];
        }
        const season = legacy || r.season === null ? null : num(r.season, 1000);
        const episode =
          legacy || r.episode === null ? null : num(r.episode, 10000);
        if (
          (season === null) !== (episode === null) ||
          (season !== null && !unique.has(`${season}:${episode}`))
        )
          throw new Error("Оценка ссылается на отсутствующий эпизод");
        return [
          {
            season,
            episode,
            score: num(r.score, 10, 1),
            createdAt: date(r.createdAt),
          },
        ];
      });
      if (
        new Set(ratings.map((r) => `${r.season}:${r.episode}`)).size !==
        ratings.length
      )
        throw new Error("Повторные оценки");
      const poster = str(show.posterUrl, 2048, true);
      if (poster && !/^https?:\/\//.test(poster) && !/^\/(?!\/)/.test(poster))
        throw new Error("Некорректная ссылка на постер");
      const genres = array(show.genres || [], 50).map(
        (v) => str(v, 100) as string,
      );
      return {
        sourceId: num(show.id),
        kind,
        tmdbId: show.tmdbId == null ? null : num(show.tmdbId, 1000000000, 1),
        name: (str(show.name, 500) as string).trim(),
        originalName: str(show.originalName, 500, true),
        posterUrl: poster,
        year: str(show.year, 20, true),
        genres,
        runtime: show.runtime == null ? null : num(show.runtime, 10000, 1),
        status: status as string,
        isFavorite: settings.isFavorite === true,
        totalSeasons: num(settings.totalSeasons ?? 1, 1000),
        totalEpisodes: num(settings.totalEpisodes ?? 0, 100000),
        dubbing: str(settings.dubbing, 500, true),
        watchSite: str(settings.watchSite, 2048, true),
        note: legacy ? "" : (str(row.note ?? "", 2000) as string),
        episodes,
        progress,
        ratings,
      } satisfies BackupTitle;
    });
    if (titles.some((t) => !t.name)) throw new Error("Пустое название тайтла");
    if (new Set(titles.map((t) => t.sourceId)).size !== titles.length)
      throw new Error("Повторные исходные ID");
    const external = titles
      .filter((t) => t.tmdbId)
      .map((t) => `${t.kind}:${t.tmdbId}`);
    if (new Set(external).size !== external.length)
      throw new Error("Повторные TMDB ID");
    const collections = array(root.collections || [], 50).map((v) => {
      const c = obj(v);
      return {
        name: (str(c.name, 200) as string).trim(),
        showIds: array(c.items || [], 1000).map((i) => num(obj(i).showId)),
      };
    });
    if (legacy)
      warnings.unshift(
        "Старый формат: отсутствуют заметки, часть статусов и оценки отдельных эпизодов. Восстановим только доступные данные.",
      );
    return { titles, collections, warnings, version: meta.version as number };
  } catch (error) {
    throw new CalendarError(
      400,
      error instanceof Error ? error.message : "Некорректный бэкап",
    );
  }
}
export function backupDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
