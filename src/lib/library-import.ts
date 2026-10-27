import { verifiedImportCatalog } from "./import-catalog";
import { titleIdentity, economyDay } from "./popcorn-economy";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CalendarError } from "./calendar-server";
import {
  backupDigest,
  parseBackup,
  type BackupTitle,
  type BackupCollection,
} from "./library-backup";
type Row = {
  index: number;
  title: string;
  state: "new" | "skip" | "attention";
  reason: string;
  showId: number | null;
  candidates: { id: number; name: string }[];
};
type Payload = {
  titles: BackupTitle[];
  collections: BackupCollection[];
  rows: Row[];
  warnings: string[];
};
type Result = {
  added: number;
  skipped: number;
  collections: number;
  messages: string[];
};
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function previewImport(
  userId: string,
  raw: unknown,
  legacyStatus: unknown,
  mapping: Record<string, unknown> = {},
  newRun = false,
) {
  const parsed = parseBackup(raw, legacyStatus);
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
    throw new CalendarError(400, "Некорректные сопоставления");
  if (Object.keys(mapping).length > 500)
    throw new CalendarError(400, "Слишком много сопоставлений");
  const catalog = await prisma.show.findMany({
    where: {
      OR: [
        {
          tmdbId: {
            in: parsed.titles.flatMap((t) => (t.tmdbId ? [t.tmdbId] : [])),
          },
        },
        { name: { in: parsed.titles.map((t) => t.name) } },
      ],
    },
    select: { id: true, tmdbId: true, kind: true, name: true },
  });
  const owned = await prisma.userShow.findMany({
    where: { userId },
    select: { showId: true },
  });
  const ids = new Set(owned.map((e) => e.showId));
  const rows: Row[] = parsed.titles.map((t, index) => {
    const candidates = catalog.filter(
      (s) =>
        s.kind === t.kind &&
        (t.tmdbId ? s.tmdbId === t.tmdbId : s.name === t.name),
    );
    let match = t.tmdbId ? candidates[0] : undefined;
    const choice = mapping[String(index)];
    if (!t.tmdbId && typeof choice === "number") {
      match = candidates.find((c) => c.id === choice);
      if (!match) throw new CalendarError(400, "Недопустимое сопоставление");
    }
    const attention =
      !t.status ||
      (!t.tmdbId && !match && choice !== "new") ||
      (!t.tmdbId && choice === "new" && candidates.length > 0);
    return {
      index,
      title: t.name,
      state: attention
        ? "attention"
        : match && ids.has(match.id)
          ? "skip"
          : "new",
      reason: !t.status
        ? "Нужен статус просмотра"
        : attention
          ? "Нет внешнего ID: выберите карточку или создание новой"
          : match && ids.has(match.id)
            ? "Уже есть — сохраняем текущие данные"
            : "Готово к добавлению",
      showId: match?.id || null,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name })),
    };
  });
  const payload: Payload = { ...parsed, rows };
  const digest = backupDigest({ raw, legacyStatus, mapping });
  // Repeating the same preview returns the same resumable job, never resets its cursor.
  const expiresAt = new Date(Date.now() + 86400000);
  const job = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    await tx.libraryImportJob.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (newRun)
      await tx.libraryImportJob.deleteMany({
        where: { userId, digest, completed: true },
      });
    const existing = await tx.libraryImportJob.findUnique({
      where: { userId_digest: { userId, digest } },
      select: { id: true },
    });
    if (
      !existing &&
      ((await tx.libraryImportJob.count({ where: { userId } })) >= 20 ||
        (await tx.libraryImportJob.count({
          where: { userId, completed: false },
        })) >= 5)
    )
      throw new CalendarError(
        429,
        "Слишком много заданий импорта. Завершите начатые или дождитесь истечения 24 часов.",
      );
    return tx.libraryImportJob.upsert({
      where: { userId_digest: { userId, digest } },
      create: {
        userId,
        digest,
        payload: json(payload),
        result: json({
          added: 0,
          skipped: 0,
          collections: 0,
          messages: [],
        } satisfies Result),
        expiresAt,
      },
      update: { expiresAt },
    });
  });
  return {
    jobId: job.id,
    rows,
    warnings: parsed.warnings,
    cursor: job.cursor,
    completed: job.completed,
    result: job.result,
    total: rows.length,
  };
}
export async function commitImport(
  userId: string,
  jobId: string,
  expectedCursor: number,
) {
  // Validate shared-catalog changes outside the write transaction in bounded
  // batches. An uploaded file is never authoritative for TMDB metadata.
  const snapshot = await prisma.libraryImportJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!snapshot) throw new CalendarError(404, "Импорт не найден");
  if (snapshot.expiresAt < new Date())
    throw new CalendarError(410, "Срок предпросмотра истёк");
  const prepared = new Map<
      number,
      Awaited<ReturnType<typeof verifiedImportCatalog>>
    >(),
    rejected = new Map<number, string>();
  if (!snapshot.completed && snapshot.cursor === expectedCursor) {
    const payload = snapshot.payload as unknown as Payload;
    const batch = payload.rows
      .slice(snapshot.cursor, snapshot.cursor + 5)
      .filter((r) => r.state === "new");
    const catalog = await prisma.show.findMany({
      where: {
        OR: [
          { id: { in: batch.flatMap((r) => (r.showId ? [r.showId] : [])) } },
          {
            tmdbId: {
              in: batch.flatMap((r) =>
                payload.titles[r.index].tmdbId
                  ? [payload.titles[r.index].tmdbId!]
                  : [],
              ),
            },
          },
        ],
      },
      include: { episodes: { select: { season: true, episode: true } } },
    });
    let next = 0;
    async function prepare() {
      while (next < batch.length) {
        const row = batch[next++],
          title = payload.titles[row.index];
        const show = row.showId
          ? catalog.find((s) => s.id === row.showId)
          : catalog.find(
              (s) =>
                s.kind === title.kind &&
                s.tmdbId === title.tmdbId &&
                title.tmdbId !== null,
            );
        const missing =
          !show ||
          title.episodes.some(
            (e) =>
              !show.episodes.some(
                (known) =>
                  known.season === e.season && known.episode === e.episode,
              ),
          );
        if (!missing) continue;
        if (show && !show.tmdbId) {
          rejected.set(
            row.index,
            "В локальной карточке не хватает серий. Сначала обновите каталог; файл не может менять общие серии без подтверждения.",
          );
          continue;
        }
        if (!show && !title.tmdbId) continue;
        try {
          prepared.set(
            row.index,
            await verifiedImportCatalog({
              ...title,
              tmdbId: show?.tmdbId || title.tmdbId,
            }),
          );
        } catch (e) {
          if (e instanceof CalendarError && e.status === 400)
            rejected.set(row.index, e.message);
          else throw e;
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(3, batch.length) }, () => prepare()),
    );
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const job = await tx.libraryImportJob.findFirst({
        where: { id: jobId, userId },
      });
      if (!job) throw new CalendarError(404, "Импорт не найден");
      if (job.expiresAt < new Date())
        throw new CalendarError(
          410,
          "Срок предпросмотра истёк. Выберите файл заново.",
        );
      const payload = job.payload as unknown as Payload;
      const result = job.result as unknown as Result;
      if (job.completed || job.cursor !== expectedCursor)
        return {
          jobId,
          cursor: job.cursor,
          total: job.completed ? job.cursor : payload.rows.length,
          completed: job.completed,
          result,
        };
      const end = Math.min(payload.rows.length, job.cursor + 5);
      for (const row of payload.rows.slice(job.cursor, end)) {
        const t = payload.titles[row.index];
        if (row.state === "skip") {
          result.skipped++;
          continue;
        }
        if (rejected.has(row.index)) {
          result.skipped++;
          result.messages.push(`${t.name}: ${rejected.get(row.index)}`);
          row.state = "attention";
          continue;
        }
        if (row.state === "attention") {
          result.skipped++;
          result.messages.push(`${t.name}: ${row.reason}`);
          continue;
        }
        let show = row.showId
          ? await tx.show.findUnique({
              where: { id: row.showId },
              select: { id: true },
            })
          : t.tmdbId
            ? await tx.show.findUnique({
                where: { tmdbId_kind: { tmdbId: t.tmdbId, kind: t.kind } },
                select: { id: true },
              })
            : null;
        if (!show && t.tmdbId && !prepared.has(row.index))
          throw new CalendarError(
            409,
            "Каталог изменился. Повторите пакет импорта.",
          );
        if (!show)
          show = await tx.show.create({
            data: {
              name: t.name,
              kind: t.kind,
              tmdbId: t.tmdbId,
              originalName: t.originalName,
              posterUrl: t.posterUrl,
              year: t.year,
              runtime: t.runtime,
              genres: t.genres,
              countries: [],
              studios: [],
              creators: [],
              createdById: userId,
              ...(prepared.get(row.index) || {}),
            },
            select: { id: true },
          });
        row.showId = show.id;
        const existing = await tx.userShow.findUnique({
          where: { userId_showId: { userId, showId: show.id } },
          select: { id: true },
        });
        if (existing) {
          result.skipped++;
          continue;
        }
        const entry = await tx.userShow.create({
          data: {
            userId,
            showId: show.id,
            kind: t.kind,
            status: t.status,
            isCompleted: t.status === "completed",
            isFavorite: t.isFavorite,
            totalSeasons: t.totalSeasons,
            totalEpisodes: t.totalEpisodes,
            dubbing: t.dubbing,
            watchSite: t.watchSite,
            notifyReleases: false,
          },
        });
        await tx.episode.createMany({
          data: t.episodes.map((e) => ({
            showId: show.id,
            season: e.season,
            episode: e.episode,
            // Do not trust calendar metadata from a personal backup.
            name: null,
            airDate: null,
          })),
          skipDuplicates: true,
        });
        const episodes = await tx.episode.findMany({
          where: { showId: show.id },
          select: { id: true, season: true, episode: true },
        });
        const episodeId = (s: number, e: number) =>
          episodes.find((v) => v.season === s && v.episode === e)!.id;
        await tx.episodeProgress.createMany({
          data: t.progress.map((p) => ({
            userShowId: entry.id,
            episodeId: episodeId(p.season, p.episode),
            watched: p.watched,
            stoppedAt: p.watched ? null : p.stoppedAt,
            watchedAt: p.watchedAt ? new Date(p.watchedAt) : null,
          })),
          skipDuplicates: true,
        });
        await tx.rating.createMany({
          data: t.ratings.map((r) => ({
            userShowId: entry.id,
            episodeId:
              r.season === null ? null : episodeId(r.season, r.episode!),
            score: r.score,
            ...(r.createdAt ? { createdAt: new Date(r.createdAt) } : {}),
          })),
        });
        if (t.note)
          await tx.personalNote.createMany({
            data: [{ userId, showId: show.id, text: t.note }],
            skipDuplicates: true,
          });
        const identity = titleIdentity(
          await tx.show.findUniqueOrThrow({
            where: { id: show.id },
            select: { id: true, kind: true, tmdbId: true },
          }),
        );
        const baseline = [
          ...t.progress
            .filter((p) => p.watched)
            .map((p) => ({
              key:
                t.kind === "movie"
                  ? `watch:${identity}`
                  : `watch:${identity}:${p.season}:${p.episode}`,
            })),
          ...(t.kind === "movie" && t.status === "completed"
            ? [{ key: `watch:${identity}` }]
            : []),
          ...t.ratings
            .filter((r) => r.season === null)
            .map(() => ({ key: `rating:${identity}` })),
        ];
        if (baseline.length)
          await tx.popcornEntry.createMany({
            data: [...new Set(baseline.map((e) => e.key))].map((eventKey) => ({
              userId,
              eventKey,
              category: "legacy",
              amount: 0,
              reason: "Данные из импорта",
              day: economyDay(),
            })),
            skipDuplicates: true,
          });
        result.added++;
      }
      const completed = end === payload.rows.length;
      if (completed) {
        const mapping = new Map(
          payload.rows
            .filter((r) => r.showId !== null && r.state !== "attention")
            .map((r) => [payload.titles[r.index].sourceId, r.showId!]),
        );
        for (const c of payload.collections) {
          const mapped = [
            ...new Set(
              c.showIds.flatMap((id) =>
                mapping.has(id) ? [mapping.get(id)!] : [],
              ),
            ),
          ];
          if (!c.name || !mapped.length) continue;
          const matches = await tx.collection.findMany({
            where: { userId, name: c.name },
          });
          if (matches.length > 1) {
            result.messages.push(
              `Коллекция ${c.name}: несколько коллекций с таким именем, пропущена`,
            );
            continue;
          }
          const collection =
            matches[0] ||
            (await tx.collection.create({ data: { userId, name: c.name } }));
          const old = await tx.collectionItem.findMany({
            where: { collectionId: collection.id },
            select: { showId: true },
          });
          const oldIds = new Set(old.map((i) => i.showId));
          await tx.collectionItem.createMany({
            data: mapped
              .filter((id) => !oldIds.has(id))
              .map((showId) => ({ collectionId: collection.id, showId })),
          });
          result.collections++;
        }
      }
      await tx.libraryImportJob.update({
        where: { id: job.id },
        data: {
          cursor: end,
          completed,
          result: json(result),
          payload: json(
            completed
              ? { titles: [], collections: [], rows: [], warnings: [] }
              : payload,
          ),
        },
      });
      return {
        jobId,
        cursor: end,
        total: payload.rows.length,
        completed,
        result,
      };
    },
    { timeout: 15000 },
  );
}
