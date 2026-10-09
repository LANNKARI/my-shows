import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Получение записей библиотеки пользователя
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId = (session.user as { id?: string }).id;
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showIdParam = searchParams.get('showId');
    const statusParam = searchParams.get('status');

    if (showIdParam) {
      const numShowId = parseInt(showIdParam, 10);
      const userShow = await prisma.userShow.findUnique({
        where: {
          userId_showId: {
            userId,
            showId: numShowId,
          },
        },
        include: {
          show: true,
          ratings: true,
          progress: true,
        },
      });

      return NextResponse.json({ item: userShow });
    }

    const items = await prisma.userShow.findMany({
      where: {
        userId,
        ...(statusParam ? { status: statusParam } : {}),
      },
      include: {
        show: true,
        ratings: true,
        progress: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch user shows', details: message },
      { status: 500 }
    );
  }
}

// POST: Добавление/обновление статуса или оценки в библиотеке
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId = (session.user as { id?: string }).id;
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    const body = await request.json();
    const rawShowId = body.showId;
    if (!rawShowId) {
      return NextResponse.json({ error: 'Missing showId' }, { status: 400 });
    }

    const numShowId = Number(rawShowId);
    if (isNaN(numShowId)) {
      return NextResponse.json({ error: 'Invalid showId' }, { status: 400 });
    }

    // Проверяем наличие тайтла в базе
    const targetShow = await prisma.show.findUnique({
      where: { id: numShowId },
    });

    if (!targetShow) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    const status = body.status || 'watching';

    // Создаем или обновляем запись в библиотеке
    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId,
          showId: numShowId,
        },
      },
      update: {
        ...(body.status ? { status } : {}),
        ...(body.isFavorite !== undefined ? { isFavorite: Boolean(body.isFavorite) } : {}),
        ...(body.isCompleted !== undefined ? { isCompleted: Boolean(body.isCompleted) } : {}),
        ...(body.dubbing ? { dubbing: body.dubbing } : {}),
        ...(body.watchSite ? { watchSite: body.watchSite } : {}),
      },
      create: {
        userId,
        showId: numShowId,
        kind: targetShow.kind,
        status,
        isFavorite: Boolean(body.isFavorite),
        isCompleted: Boolean(body.isCompleted),
        dubbing: body.dubbing || null,
        watchSite: body.watchSite || null,
      },
      include: {
        show: true,
        ratings: true,
        progress: true,
      },
    });

    // Если была передана оценка (score 1-10)
    if (body.score !== undefined && body.score !== null) {
      const score = Math.min(Math.max(Number(body.score), 1), 10);
      const existingRating = await prisma.rating.findFirst({
        where: { userShowId: userShow.id, episodeId: null },
      });

      if (existingRating) {
        await prisma.rating.update({
          where: { id: existingRating.id },
          data: { score },
        });
      } else {
        await prisma.rating.create({
          data: {
            userShowId: userShow.id,
            score,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      item: userShow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update user show', details: message },
      { status: 500 }
    );
  }
}