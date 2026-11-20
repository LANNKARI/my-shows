import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { titleImages } from "@/lib/title-images";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const showId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(showId) || showId < 1)
    return NextResponse.json({ error: "Некорректный тайтл" }, { status: 400 });
  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { tmdbId: true, kind: true },
    });
    if (!show)
      return NextResponse.json({ error: "Тайтл не найден" }, { status: 404 });
    const images = show.tmdbId ? await titleImages(show.tmdbId, show.kind) : [];
    return NextResponse.json(
      { images },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=21600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Не удалось загрузить кадры. Попробуйте ещё раз." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
