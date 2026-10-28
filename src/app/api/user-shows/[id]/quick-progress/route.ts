import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeWatched } from "@/lib/library-mutations";
import { getCurrentUserId } from "@/lib/current-user";
import {
  progressFingerprint,
  signProgressUndo,
  verifyProgressUndo,
  type ProgressUndo,
} from "@/lib/progress-undo";

const include = {
  show: {
    include: {
      episodes: {
        orderBy: [
          { season: "asc" as const },
          { episode: "asc" as const },
          { id: "asc" as const },
        ],
      },
    },
  },
  progress: { orderBy: { episodeId: "asc" as const } },
};
type Entry = Prisma.UserShowGetPayload<{ include: typeof include }>;
class ProgressError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fingerprint = (entry: Entry) =>
  progressFingerprint({
    id: entry.id,
    updatedAt: entry.updatedAt,
    status: entry.status,
    isCompleted: entry.isCompleted,
    totalEpisodes: entry.totalEpisodes,
    totalSeasons: entry.totalSeasons,
    episodes: entry.show.episodes.map((episode) => [
      episode.id,
      episode.season,
      episode.episode,
    ]),
    progress: entry.progress,
  });
const resultItem = (entry: Entry) => ({
  userShowId: entry.id,
  status: entry.status,
  updatedAt: entry.updatedAt,
  progress: entry.progress,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url);
  // Next может нормализовать 127.0.0.1 в localhost; Host сохраняет адрес браузера.
  requestOrigin.host = request.headers.get("host") || requestOrigin.host;
  if (origin && origin !== requestOrigin.origin)
    return NextResponse.json(
      { error: "Недопустимый источник запроса" },
      { status: 403 },
    );
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const userShowId = Number((await params).id);
  if (!Number.isSafeInteger(userShowId) || userShowId <= 0)
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !["mark", "undo"].includes(body.action)
  )
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const secret = process.env.AUTH_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Сохранение временно недоступно" },
      { status: 503 },
    );
  const undo =
    body.action === "undo" && typeof body.token === "string"
      ? verifyProgressUndo(body.token, secret)
      : null;
  if (
    body.action === "undo" &&
    (!undo || undo.userId !== userId || undo.userShowId !== userShowId)
  )
    return NextResponse.json(
      { error: "Отмена недоступна или срок её действия истёк" },
      { status: 400 },
    );
  if (
    body.action === "mark" &&
    (typeof body.expectedUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(body.expectedUpdatedAt)))
  )
    return NextResponse.json(
      { error: "Обновите библиотеку перед сохранением" },
      { status: 400 },
    );

  try {
    const response = await prisma.$transaction(
      async (tx) => {
        // Один владелец, одна запись, одна сериализуемая операция даже при двух вкладках.
        const owned = await tx.$queryRaw<
          { id: number }[]
        >`SELECT id FROM "UserShow" WHERE id = ${userShowId} AND "userId" = ${userId} FOR UPDATE`;
        if (!owned.length) throw new ProgressError(404, "Запись не найдена");
        const entry = await tx.userShow.findUniqueOrThrow({
          where: { id: userShowId },
          include,
        });
        const revision = new Date(
          Math.max(Date.now(), entry.updatedAt.getTime() + 1),
        );
        if (body.action === "undo" && undo) {
          if (fingerprint(entry) !== undo.fingerprint)
            throw new ProgressError(
              409,
              "Прогресс уже изменился. Обновите библиотеку: отмена не должна затирать новые изменения.",
            );
          for (const progress of undo.progress) {
            if (progress.before) {
              await tx.episodeProgress.update({
                where: {
                  userShowId_episodeId: {
                    userShowId,
                    episodeId: progress.episodeId,
                  },
                },
                data: {
                  ...progress.before,
                  watchedAt: progress.before.watchedAt
                    ? new Date(progress.before.watchedAt)
                    : null,
                },
              });
            } else {
              await tx.episodeProgress.deleteMany({
                where: { userShowId, episodeId: progress.episodeId },
              });
            }
          }
          await tx.userShow.update({
            where: { id: userShowId },
            data: { ...undo.before, updatedAt: revision },
          });
          const restored = await tx.userShow.findUniqueOrThrow({
            where: { id: userShowId },
            include,
          });
          return { item: resultItem(restored), message: "Отметка отменена" };
        }

        if (entry.updatedAt.getTime() !== Date.parse(body.expectedUpdatedAt))
          throw new ProgressError(
            409,
            "Прогресс уже изменился. Обновите библиотеку.",
          );
        const movie = entry.show.kind === "movie";
        if (
          !(
            entry.status === "watching" ||
            (movie && entry.status === "planned")
          )
        )
          throw new ProgressError(
            409,
            "Быстрая отметка недоступна для этого статуса",
          );
        if (movie && !entry.show.episodes.length) {
          const episode = await tx.episode.upsert({
            where: {
              showId_season_episode: {
                showId: entry.showId,
                season: 1,
                episode: 1,
              },
            },
            create: { showId: entry.showId, season: 1, episode: 1 },
            update: {},
          });
          entry.show.episodes = [episode];
        }
        const watched = new Set(
          entry.progress
            .filter((progress) => progress.watched)
            .map((progress) => progress.episodeId),
        );
        const next = entry.show.episodes.find(
          (episode) => !watched.has(episode.id),
        );
        if (!movie && (!next || body.expectedEpisodeId !== next.id))
          throw new ProgressError(
            409,
            "Следующая серия изменилась или ещё не загружена. Обновите библиотеку или откройте трекер.",
          );
        const affected = movie ? entry.show.episodes : [next!];
        const before: ProgressUndo["progress"] = affected.map((episode) => {
          const old = entry.progress.find(
            (progress) => progress.episodeId === episode.id,
          );
          return {
            episodeId: episode.id,
            before: old
              ? {
                  watched: old.watched,
                  stoppedAt: old.stoppedAt,
                  watchedAt: old.watchedAt?.toISOString() ?? null,
                }
              : null,
          };
        });
        await writeWatched(
          tx,
          userShowId,
          affected,
          entry.progress,
          true,
          revision,
          entry,
        );
        for (const episode of affected) watched.add(episode.id);
        const total = Math.max(entry.totalEpisodes, entry.show.episodes.length);
        const complete =
          movie ||
          (total > 0 &&
            entry.show.episodes.every((episode) => watched.has(episode.id)) &&
            entry.show.episodes.filter((episode) => watched.has(episode.id))
              .length >= total);
        await tx.userShow.update({
          where: { id: userShowId },
          data: {
            status: complete ? "completed" : "watching",
            ...(movie ? { totalEpisodes: 1 } : {}),
            isCompleted: complete,
            updatedAt: revision,
          },
        });
        const updated = await tx.userShow.findUniqueOrThrow({
          where: { id: userShowId },
          include,
        });
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const undoToken = signProgressUndo(
          {
            version: 1,
            userId,
            userShowId,
            expiresAt,
            before: { status: entry.status, isCompleted: entry.isCompleted },
            progress: before,
            fingerprint: fingerprint(updated),
          },
          secret,
        );
        return {
          item: resultItem(updated),
          undoToken,
          undoExpiresAt: expiresAt,
          message: movie ? "Фильм отмечен просмотренным" : "Серия отмечена",
          episode: movie
            ? null
            : { season: next!.season, episode: next!.episode },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
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
        { error: "Прогресс уже изменился. Обновите библиотеку." },
        { status: 409 },
      );
    console.error("Quick progress failed:", error);
    return NextResponse.json(
      { error: "Не удалось сохранить изменение. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
