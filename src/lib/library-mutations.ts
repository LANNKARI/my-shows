import { activityEvents, titleIdentity } from "@/lib/popcorn-economy";
import { releaseDefaults } from "@/lib/release-defaults";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateLibraryInput } from "@/lib/library-validation";
import { summarizeProgress } from "@/lib/progress";

const include = {
  show: { include: { episodes: true } },
  progress: true,
  ratings: true,
};
type Entry = Prisma.UserShowGetPayload<{ include: typeof include }>;
type Tx = Prisma.TransactionClient;
export class ProgressError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function object(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ProgressError(400, "Некорректный запрос");
}
function validId(id: unknown): asserts id is number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw new ProgressError(400, "Некорректный ID");
}
const revision = (entry: { updatedAt: Date }) =>
  new Date(Math.max(Date.now(), entry.updatedAt.getTime() + 1));
async function lockedEntry(tx: Tx, userId: string, showId: number) {
  let show = await tx.show.findUnique({ where: { id: showId } });
  if (!show) show = await tx.show.findFirst({ where: { tmdbId: showId } });
  if (!show) throw new ProgressError(404, "Тайтл не найден");
  const existing = await tx.userShow.findUnique({
    where: { userId_showId: { userId, showId: show.id } },
    select: { id: true },
  });
  const defaults = existing ? {} : await releaseDefaults(userId, show.kind, tx);
  const entry = await tx.userShow.upsert({
    where: { userId_showId: { userId, showId: show.id } },
    update: {},
    create: {
      userId,
      showId: show.id,
      kind: show.kind,
      status: "watching",
      ...defaults,
    },
  });
  await tx.$queryRaw`SELECT id FROM "UserShow" WHERE id = ${entry.id} AND "userId" = ${userId} FOR UPDATE`;
  return tx.userShow.findUniqueOrThrow({ where: { id: entry.id }, include });
}
function transaction<T>(work: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(work, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15000,
  });
}

/** Preserve dates on repeated marks, and do not fabricate dates for old watched rows. */
export async function writeWatched(
  tx: Tx,
  userShowId: number,
  episodes: { id: number; season: number; episode: number }[],
  previous: { episodeId: number; watched: boolean; watchedAt: Date | null }[],
  watched: boolean,
  at: Date,
  entry: Pick<Entry, "userId" | "show">,
) {
  const ids = episodes.map((episode) => episode.id);
  const existing = new Set(previous.map((progress) => progress.episodeId));
  const missing = ids.filter((id) => !existing.has(id));
  if (missing.length)
    await tx.episodeProgress.createMany({
      data: missing.map((episodeId) => ({
        userShowId,
        episodeId,
        watched,
        watchedAt: watched ? at : null,
      })),
      skipDuplicates: true,
    });
  if (watched) {
    const alreadyWatched = new Set(
      previous.filter((p) => p.watched).map((p) => p.episodeId),
    );
    const newlyWatched = episodes.filter(
      (episode) => !alreadyWatched.has(episode.id),
    );
    const identity = titleIdentity(entry.show);
    await activityEvents(
      tx,
      entry.userId,
      entry.show.kind === "movie"
        ? newlyWatched.length
          ? [
              {
                key: `watch:${identity}`,
                amount: 10,
                reason: `Просмотрен фильм: ${entry.show.name}`,
              },
            ]
          : []
        : newlyWatched.map((e) => ({
            key: `watch:${identity}:${e.season}:${e.episode}`,
            amount: 3,
            reason: `Просмотрена серия: ${entry.show.name}, ${e.season}×${e.episode}`,
          })),
    );
    await tx.episodeProgress.updateMany({
      where: { userShowId, episodeId: { in: ids }, watched: false },
      data: { watched: true, watchedAt: at, stoppedAt: null },
    });
    // Clearing old timecodes must not move a previous viewing into today's history.
    await tx.episodeProgress.updateMany({
      where: { userShowId, episodeId: { in: ids }, watched: true },
      data: { stoppedAt: null },
    });
  } else {
    await tx.episodeProgress.updateMany({
      where: { userShowId, episodeId: { in: ids } },
      data: { watched: false, watchedAt: null },
    });
  }
}

async function ensureMovie(tx: Tx, entry: Entry) {
  if (entry.show.kind === "movie" && !entry.show.episodes.length) {
    const episode = await tx.episode.upsert({
      where: {
        showId_season_episode: { showId: entry.showId, season: 1, episode: 1 },
      },
      create: { showId: entry.showId, season: 1, episode: 1 },
      update: {},
    });
    entry.show.episodes = [episode];
  }
}

export async function saveLibrary(
  userId: string,
  showId: number,
  body: unknown,
) {
  validId(showId);
  object(body);
  const error = validateLibraryInput(body);
  if (error) throw new ProgressError(400, error);
  return transaction(async (tx) => {
    const entry = await lockedEntry(tx, userId, showId);
    const at = revision(entry);
    if (body.status === "completed") {
      await ensureMovie(tx, entry);
      if (
        !entry.show.episodes.length ||
        (entry.show.kind !== "movie" &&
          entry.show.episodes.length < entry.totalEpisodes)
      )
        throw new ProgressError(
          409,
          "Недостаточно данных о сериях для завершения. Откройте трекер, чтобы обновить список серий.",
        );
      await writeWatched(
        tx,
        entry.id,
        entry.show.episodes,
        entry.progress,
        true,
        at,
        entry,
      );
    }
    await tx.userShow.update({
      where: { id: entry.id },
      data: {
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        isCompleted: (body.status ?? entry.status) === "completed",
        ...(body.isFavorite !== undefined
          ? { isFavorite: body.isFavorite as boolean }
          : {}),
        ...(body.dubbing !== undefined
          ? {
              dubbing:
                typeof body.dubbing === "string"
                  ? body.dubbing.trim() || null
                  : null,
            }
          : {}),
        ...(body.watchSite !== undefined
          ? {
              watchSite:
                typeof body.watchSite === "string"
                  ? body.watchSite.trim() || null
                  : null,
            }
          : {}),
        kind: entry.show.kind,
        totalEpisodes:
          entry.show.kind === "movie"
            ? 1
            : Math.max(entry.totalEpisodes, entry.show.episodes.length),
        updatedAt: at,
      },
    });
    if (typeof body.score === "number") {
      await activityEvents(tx, userId, [
        {
          key: `rating:${titleIdentity(entry.show)}`,
          amount: 2,
          reason: `Первая оценка: ${entry.show.name}`,
        },
      ]);
      const updated = await tx.rating.updateMany({
        where: { userShowId: entry.id, episodeId: null },
        data: { score: body.score },
      });
      if (!updated.count)
        await tx.rating.create({
          data: { userShowId: entry.id, score: body.score },
        });
    }
    return tx.userShow.findUniqueOrThrow({
      where: { id: entry.id },
      include: { progress: true, ratings: true },
    });
  });
}

function validateEpisodeBody(
  body: unknown,
): asserts body is Record<string, unknown> {
  object(body);
  for (const key of ["watched", "markSeasonWatched"])
    if (body[key] !== undefined && typeof body[key] !== "boolean")
      throw new ProgressError(
        400,
        "Отметка просмотра должна быть true или false",
      );
  if (
    body.stoppedAt !== undefined &&
    body.stoppedAt !== null &&
    (typeof body.stoppedAt !== "string" ||
      body.stoppedAt.length > 12 ||
      (body.stoppedAt.trim() &&
        !/^\d{1,3}:(?:[0-5]\d:)?[0-5]\d$/.test(body.stoppedAt.trim())))
  )
    throw new ProgressError(400, "Введите время в формате ММ:СС или ЧЧ:ММ:СС");
  const season =
    body.seasonNumber !== undefined || body.markSeasonWatched !== undefined;
  if (season) {
    if (
      typeof body.seasonNumber !== "number" ||
      !Number.isSafeInteger(body.seasonNumber) ||
      body.seasonNumber < 0 ||
      typeof body.markSeasonWatched !== "boolean" ||
      body.episodeId !== undefined ||
      body.watched !== undefined ||
      body.stoppedAt !== undefined
    )
      throw new ProgressError(400, "Некорректная отметка сезона");
  } else {
    validId(body.episodeId);
    if (body.watched === undefined && body.stoppedAt === undefined)
      throw new ProgressError(400, "Не указано изменение прогресса");
  }
}
async function changeProgress(
  tx: Tx,
  entry: Entry,
  body: Record<string, unknown>,
) {
  const at = revision(entry);
  const season = body.seasonNumber !== undefined;
  const episodes = entry.show.episodes.filter((episode) =>
    season
      ? episode.season === body.seasonNumber
      : episode.id === body.episodeId,
  );
  if (!episodes.length)
    throw new ProgressError(
      404,
      season ? "Сезон не найден" : "Серия не принадлежит этому тайтлу",
    );
  const watched = season ? body.markSeasonWatched : body.watched;
  const stoppedAt =
    typeof body.stoppedAt === "string" ? body.stoppedAt.trim() || null : null;
  if (
    stoppedAt &&
    (watched === true ||
      (watched === undefined &&
        entry.progress.some(
          (progress) =>
            progress.episodeId === episodes[0].id && progress.watched,
        )))
  )
    throw new ProgressError(
      409,
      "Сначала снимите отметку просмотра с этой серии, чтобы указать время остановки.",
    );
  if (typeof watched === "boolean")
    await writeWatched(
      tx,
      entry.id,
      episodes,
      entry.progress,
      watched,
      at,
      entry,
    );
  if (!season && body.stoppedAt !== undefined)
    await tx.episodeProgress.upsert({
      where: {
        userShowId_episodeId: {
          userShowId: entry.id,
          episodeId: episodes[0].id,
        },
      },
      create: { userShowId: entry.id, episodeId: episodes[0].id, stoppedAt },
      update: { stoppedAt },
    });
  const fresh = await tx.userShow.findUniqueOrThrow({
    where: { id: entry.id },
    include,
  });
  const summary = summarizeProgress(fresh);
  const status =
    typeof watched !== "boolean"
      ? entry.status
      : watched && summary.complete
        ? "completed"
        : entry.status === "completed"
          ? "watching"
          : watched && entry.status === "planned"
            ? "watching"
            : entry.status;
  const item = await tx.userShow.update({
    where: { id: entry.id },
    data: { status, isCompleted: status === "completed", updatedAt: at },
    include: { progress: true, ratings: true },
  });
  return {
    success: true,
    item,
    ...(season
      ? { updatedSeason: body.seasonNumber }
      : {
          progress: item.progress.find(
            (progress) => progress.episodeId === body.episodeId,
          ),
        }),
  };
}
export async function saveProgress(
  userId: string,
  showId: number,
  body: unknown,
) {
  validId(showId);
  validateEpisodeBody(body);
  return transaction(async (tx) =>
    changeProgress(tx, await lockedEntry(tx, userId, showId), body),
  );
}
export async function saveProgressByRecord(
  userId: string,
  userShowId: number,
  progressId: number,
  body: unknown,
) {
  validId(userShowId);
  validId(progressId);
  object(body);
  // This old endpoint addresses EpisodeProgress.id rather than Episode.id.
  return transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { id: number }[]
    >`SELECT id FROM "UserShow" WHERE id = ${userShowId} AND "userId" = ${userId} FOR UPDATE`;
    if (!locked.length) throw new ProgressError(404, "Запись не найдена");
    const entry = await tx.userShow.findUniqueOrThrow({
      where: { id: userShowId },
      include,
    });
    const progress = entry.progress.find(
      (progress) => progress.id === progressId,
    );
    if (!progress) throw new ProgressError(404, "Прогресс не найден");
    const input = { ...body, episodeId: progress.episodeId };
    validateEpisodeBody(input);
    const result = await changeProgress(tx, entry, input);
    return result.item.progress.find((value) => value.id === progressId);
  });
}
export function mutationErrorResponse(error: unknown) {
  if (error instanceof ProgressError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (["P2034", "P2002"].includes(error.code) ||
      (error.code === "P2010" &&
        ["40001", "40P01"].includes(String(error.meta?.code))))
  )
    return NextResponse.json(
      { error: "Прогресс уже изменился. Обновите страницу перед повтором." },
      { status: 409 },
    );
  console.error("Library mutation failed", error);
  return NextResponse.json(
    { error: "Не удалось сохранить изменение" },
    { status: 500 },
  );
}
