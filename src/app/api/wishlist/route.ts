import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { translateGenres } from '@/lib/genres';

// Получение списка желаемого
export async function GET() {
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

    // Ищем записи со статусом "planned"
    const items = await prisma.userShow.findMany({
      where: {
        userId,
        OR: [
          { status: 'planned' },
          { status: 'PLANNED' },
        ],
      },
      include: {
        show: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(items);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch wishlist', details: message },
      { status: 500 }
    );
  }
}

// Добавление тайтла в Wishlist
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
    const rawTmdbId = body.tmdbId;

    const numShowId = rawShowId ? Number(rawShowId) : null;
    const numTmdbId = rawTmdbId ? Number(rawTmdbId) : null;

    // 1. Ищем фильм по ID или TMDB ID
    let show = numShowId && !isNaN(numShowId)
      ? await prisma.show.findUnique({ where: { id: numShowId } })
      : null;

    if (!show && numTmdbId && !isNaN(numTmdbId)) {
      show = await prisma.show.findFirst({ where: { tmdbId: numTmdbId } });
    }

    // 2. Если фильма нет в базе — создаем его через TMDB
    if (!show && numTmdbId && !isNaN(numTmdbId)) {
      const apiKey =
        process.env.TMDB_API_KEY ||
        process.env.TMDB_READ_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_TMDB_API_KEY ||
        '';

      const mediaType = body.type === 'tv' ? 'tv' : 'movie';
      let tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${numTmdbId}?language=ru-RU`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (apiKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        tmdbUrl += `&api_key=${apiKey}`;
      }

      const resTmdb = await fetch(tmdbUrl, { headers });
      if (resTmdb.ok) {
        const data = await resTmdb.json();
        const rawGenreNames = (data.genres || []).map((g: { name: string }) => g.name);
        const translatedGenres: string[] = translateGenres(rawGenreNames);
        const releaseDate = data.release_date || data.first_air_date || null;
        const year = releaseDate ? releaseDate.slice(0, 4) : null;
        const kind = mediaType === 'tv' ? 'series' : 'movie';

        show = await prisma.show.create({
          data: {
            tmdbId: numTmdbId,
            name: data.title || data.name || 'Без названия',
            originalName: data.original_title || data.original_name || null,
            description: data.overview || '',
            kind,
            posterUrl: data.poster_path
              ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
              : null,
            year,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            genres: translatedGenres,
            tmdbRating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : 0,
            tmdbVotes: data.vote_count || 0,
          },
        });
      }
    }

    if (!show) {
      return NextResponse.json({ error: 'Show not found in database' }, { status: 404 });
    }

    // 3. Сохраняем в таблицу UserShow со статусом planned
    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId,
          showId: show.id,
        },
      },
      update: {
        status: 'planned',
      },
      create: {
        userId,
        showId: show.id,
        kind: show.kind,
        status: 'planned',
      },
      include: {
        show: true,
      },
    });

    return NextResponse.json({
      success: true,
      item: userShow,
      showId: show.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update wishlist', details: message },
      { status: 500 }
    );
  }
}