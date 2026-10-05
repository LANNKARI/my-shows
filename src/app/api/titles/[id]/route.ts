import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

async function findOwnedTitle(id: number, userId: string) {
  return prisma.title.findFirst({ where: { id, userId } });
}

// Распределяем N серий по S сезонам как можно ровнее
function distributeEpisodes(totalSeasons: number, totalEpisodes: number) {
  if (totalSeasons < 1 || totalEpisodes < 1) return [];
  const base = Math.floor(totalEpisodes / totalSeasons);
  const extra = totalEpisodes % totalSeasons;
  const result: number[] = [];
  for (let s = 0; s < totalSeasons; s++) {
    result.push(base + (s < extra ? 1 : 0));
  }
  return result;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const title = await prisma.title.findFirst({
    where: { id, userId: user.id },
    include: {
      episodes: { orderBy: [{ season: "asc" }, { episode: "asc" }] },
      ratings: true,
      collections: { include: { collection: true } },
    },
  });
  if (!title) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(title);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await findOwnedTitle(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();

  // ---- Обычные поля Title ----
  const data: any = {};
  for (const k of ["name", "originalName", "dubbing", "watchSite", "posterUrl", "kind"]) {
    if (k in body) data[k] = body[k] || null;
  }
  if ("isCompleted" in body) data.isCompleted = !!body.isCompleted;

  const newTotalSeasons =
    "totalSeasons" in body ? Math.max(1, Number(body.totalSeasons) || 1) : owned.totalSeasons;
  const newTotalEpisodes =
    "totalEpisodes" in body ? Math.max(0, Number(body.totalEpisodes) || 0) : owned.totalEpisodes;

  if ("totalSeasons" in body) data.totalSeasons = newTotalSeasons;
  // totalEpisodes обновим ПОСЛЕ синхронизации — по фактическому количеству

  await prisma.title.update({ where: { id }, data });

  // ---- Синхронизация эпизодов (только для сериалов) ----
  const kind = body.kind ?? owned.kind;
  const targetTotal = newTotalEpisodes;

  if (kind === "series" && targetTotal > 0) {
    const plan = distributeEpisodes(newTotalSeasons, targetTotal);

    // 1. Удаляем серии из сезонов, которых больше нет в плане
    const existingSeasons = new Set(plan.map((_, idx) => idx + 1));
    const episodesToDelete = await prisma.episode.findMany({
      where: { titleId: id, season: { notIn: Array.from(existingSeasons) } },
    });
    for (const ep of episodesToDelete) {
      if (!ep.watched) {
        await prisma.episode.delete({ where: { id: ep.id } });
      }
    }

    // 2. Синхронизируем каждый сезон
    const maxKeepWatchedByPosition = new Map<string, number>(); // "season-episode" -> максимум

    for (let s = 1; s <= plan.length; s++) {
      const shouldHave = plan[s - 1];
      const currentEps = await prisma.episode.findMany({
        where: { titleId: id, season: s },
        orderBy: { episode: "asc" },
      });

      // Если серий больше, чем нужно — удаляем непросмотренные с конца
      const toRemove = currentEps.slice(shouldHave);
      const toRemoveSafe = toRemove.filter((e) => !e.watched);
      for (const ep of toRemoveSafe) {
        await prisma.episode.delete({ where: { id: ep.id } });
      }

      // Если серий меньше — создаём недостающие
      if (currentEps.length < shouldHave) {
        const startFrom = currentEps.length + 1;
        const eps: { titleId: number; season: number; episode: number }[] = [];
        for (let e = startFrom; e <= shouldHave; e++) {
          eps.push({ titleId: id, season: s, episode: e });
        }
        if (eps.length) {
          await prisma.episode.createMany({ data: eps });
        }
      }
    }

    // 3. Если сезонов стало меньше — оставляем только те, что в плане
    //    (уже сделали удалением в п.1)
  }

  // ---- Обновляем totalEpisodes по фактическому количеству ----
  const finalCount = await prisma.episode.count({ where: { titleId: id } });
  await prisma.title.update({
    where: { id },
    data: { totalEpisodes: finalCount },
  });

  const updated = await prisma.title.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);

  const owned = await findOwnedTitle(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.title.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}