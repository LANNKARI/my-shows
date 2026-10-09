import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Получение всех тайтлов библиотеки текущего пользователя
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

    // Если запрошен конкретный тайтл
    if (showIdParam) {
      const numShowId = parseInt(showIdParam, 10);
      const userShow = await prisma.userShow.findFirst({
        where: {
          userId,
          OR: [{ showId: numShowId }, { id: numShowId }],
        },
        include: {
          show: true,
          ratings: true,
          progress: true,
        },
      });

      return NextResponse.json(userShow || null);
    }

    // 1. Загружаем сериалы и фильмы пользователя из UserShow
    const userShows = await prisma.userShow.findMany({
      where: {
        userId,
        ...(statusParam ? { status: statusParam } : {}),
      },
      include: {
        show: {
          include: {
            episodes: true,
          },
        },
        ratings: true,
        progress: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 2. Проверяем, есть ли старые сериалы в таблице Title, не перенесенные в UserShow
    const oldTitles = await prisma.title.findMany({
      where: { userId },
      include: {
        episodes: true,
        ratings: true,
      },
    });

    // Автоматическая миграция старых записей
    if (oldTitles.length > 0) {
      for (const t of oldTitles) {
        const exists = userShows.some(
          (us) => us.show?.name.toLowerCase() === t.name.toLowerCase()
        );

        if (!exists) {
          let s = await prisma.show.findFirst({ where: { name: t.name } });
          if (!s) {
            s = await prisma.show.create({
              data: {
                name: t.name,
                originalName: t.originalName,
                posterUrl: t.posterUrl,
                kind: t.kind || 'series',
                genres: [],
              },
            });
          }

          const newUs = await prisma.userShow.create({
            data: {
              userId,
              showId: s.id,
              kind: t.kind || 'series',
              status: t.isCompleted ? 'completed' : 'watching',
              isCompleted: t.isCompleted,
              isFavorite: t.isFavorite,
              totalSeasons: t.totalSeasons,
              totalEpisodes: t.totalEpisodes,
              dubbing: t.dubbing,
              watchSite: t.watchSite,
            },
            include: {
              show: {
                include: {
                  episodes: true,
                },
              },
              ratings: true,
              progress: true,
            },
          });

          userShows.push(newUs);
        }
      }
    }

    // 3. Формируем универсальный массив объектов, понятный всем карточкам сайта
    const normalized = userShows.map((us) => ({
      id: us.id,
      userShowId: us.id,
      showId: us.showId,
      name: us.show?.name || 'Без названия',
      title: us.show?.name || 'Без названия',
      originalName: us.show?.originalName,
      originalTitle: us.show?.originalName,
      posterUrl: us.show?.posterUrl,
      kind: us.kind || us.show?.kind || 'series',
      status: us.status || 'watching',
      isCompleted: us.isCompleted,
      isFavorite: us.isFavorite,
      totalSeasons: us.totalSeasons,
      totalEpisodes: us.totalEpisodes,
      dubbing: us.dubbing,
      watchSite: us.watchSite,
      show: {
        ...us.show,
        title: us.show?.name,
        originalTitle: us.show?.originalName,
      },
      progress: us.progress || [],
      ratings: us.ratings || [],
      updatedAt: us.updatedAt,
      createdAt: us.createdAt,
    }));

    // Отдаем прямой массив для работы страницы библиотеки
    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch user shows', details: message },
      { status: 500 }
    );
  }
}

// POST: Обновление статуса, заметок и оценок тайтла
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
    const rawShowId = body.showId ?? body.tmdbId;

    if (!rawShowId) {
      return NextResponse.json({ error: 'Missing showId' }, { status: 400 });
    }

    const numShowId = Number(rawShowId);

    // 1. Находим тайтл по showId или tmdbId
    let targetShow = await prisma.show.findFirst({
      where: {
        OR: [
          { id: isNaN(numShowId) ? undefined : numShowId },
          { tmdbId: isNaN(numShowId) ? undefined : numShowId },
        ],
      },
    });

    // 2. Если не найден в Show — проверяем старую таблицу Title
    if (!targetShow && !isNaN(numShowId)) {
      const oldTitle = await prisma.title.findUnique({ where: { id: numShowId } });
      if (oldTitle) {
        targetShow = await prisma.show.create({
          data: {
            name: oldTitle.name,
            originalName: oldTitle.originalName,
            posterUrl: oldTitle.posterUrl,
            kind: oldTitle.kind || 'series',
            genres: [],
          },
        });
      }
    }

    // 3. Если всё ещё нет — создаем запись из TMDB
    if (!targetShow && !isNaN(numShowId)) {
      const apiKey =
        process.env.TMDB_API_KEY ||
        process.env.TMDB_READ_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_TMDB_API_KEY ||
        '';

      if (apiKey) {
        const mediaType = body.kind === 'movie' ? 'movie' : 'tv';
        let u = `https://api.themoviedb.org/3/${mediaType}/${numShowId}?language=ru-RU`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
        else u += `&api_key=${apiKey}`;

        const resTmdb = await fetch(u, { headers });
        if (resTmdb.ok) {
          const d = await resTmdb.json();
          targetShow = await prisma.show.create({
            data: {
              tmdbId: numShowId,
              name: d.title || d.name || 'Без названия',
              originalName: d.original_title || d.original_name || null,
              description: d.overview || '',
              kind: mediaType === 'tv' ? 'series' : 'movie',
              posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
              genres: [],
            },
          });
        }
      }
    }

    if (!targetShow) {
      return NextResponse.json({ error: 'Тайтл не найден в базе' }, { status: 404 });
    }

    const status = body.status || 'watching';
    const isCompleted = status === 'completed';

    // 4. Сохраняем в UserShow
    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId,
          showId: targetShow.id,
        },
      },
      update: {
        ...(body.status ? { status } : {}),
        ...(status === 'completed' ? { isCompleted: true } : {}),
        ...(body.isCompleted !== undefined ? { isCompleted: Boolean(body.isCompleted) } : {}),
        ...(body.isFavorite !== undefined ? { isFavorite: Boolean(body.isFavorite) } : {}),
        ...(body.dubbing ? { dubbing: body.dubbing } : {}),
        ...(body.watchSite ? { watchSite: body.watchSite } : {}),
      },
      create: {
        userId,
        showId: targetShow.id,
        kind: targetShow.kind || 'series',
        status,
        isCompleted,
        isFavorite: Boolean(body.isFavorite),
        dubbing: body.dubbing || null,
        watchSite: body.watchSite || null,
      },
      include: {
        show: true,
        ratings: true,
        progress: true,
      },
    });

    // 5. Сохраняем оценку, если передана
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
      userShow,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update user show', details: message },
      { status: 500 }
    );
  }
}