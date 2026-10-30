import { prisma } from "./prisma";
import type { ActorCredit } from "./actor-types";
export async function actorLibrary(
  userId: string,
  credits: Pick<ActorCredit, "id" | "kind">[],
  db = prisma,
) {
  const movies = credits.filter((c) => c.kind === "movie").map((c) => c.id);
  const series = credits.filter((c) => c.kind === "series").map((c) => c.id);
  const entries = await db.userShow.findMany({
    where: {
      userId,
      show: {
        OR: [
          { kind: "movie", tmdbId: { in: movies } },
          { kind: "series", tmdbId: { in: series } },
        ],
      },
    },
    select: { show: { select: { kind: true, tmdbId: true } } },
  });
  return entries.map((e) => `${e.show.kind}:${e.show.tmdbId}`);
}
