import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { translateGenres } from '@/lib/genres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing show id' }, { status: 400 });
    }

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // 1. Ищем тайтл в локальной базе данных по ID или TMDB ID
    let show = await prisma.show.findFirst({
      where: {
        OR: [
          { id: numId },
          { tmdbId: numId },
        ],
      },
      include: {
        episodes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 2. Если фильм уже есть в базе — отдаем его (с полем title для фронтенда)
    if (show) {
      return NextResponse.json({
        show: {
          ...show,
          title: show.name,
          originalTitle: show.originalName,
        },
      });
    }

    // 3. Если фильма нет в базе — автоматически импортируем из TMDB
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (apiKey) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const buildUrl = (type: 'movie' | 'tv') => {
        let u = `https://api.themoviedb.org/3/${type}/${numId}?language=ru-RU`;
        if (!apiKey.startsWith('eyJ')) u += `&api_key=${apiKey}`;
        return u;
      };

      let tmdbRes = await fetch(buildUrl('movie'), { headers });
      let mediaType: 'movie' | 'tv' = 'movie';

      if (!tmdbRes.ok) {
        tmdbRes = await fetch(buildUrl('tv'), { headers });
        mediaType = 'tv';
      }

      if (tmdbRes.ok) {
        const data = await tmdbRes.json();
        const name = data.title || data.name || 'Без названия';
        const originalName = data.original_title || data.original_name || null;
        const description = data.overview || '';
        const releaseDate = data.release_date || data.first_air_date || null;
        const year = releaseDate ? releaseDate.slice(0, 4) : null;
        const posterUrl = data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : null;
        const tmdbRating = data.vote_average ? Math.round(data.vote_average * 10) / 10 : 0;
        const tmdbVotes = data.vote_count || 0;
        const kind = mediaType === 'tv' ? 'series' : 'movie';

        const rawGenreNames = (data.genres || []).map((g: { name: string }) => g.name);
        const translatedGenres: string[] = translateGenres(rawGenreNames);

        const createdShow = await prisma.show.create({
          data: {
            tmdbId: numId,
            name,
            originalName,
            description,
            kind,
            posterUrl,
            year,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            genres: translatedGenres,
            tmdbRating,
            tmdbVotes,
          },
          include: {
            episodes: true,
            comments: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, avatarUrl: true },
                },
              },
            },
          },
        });

        return NextResponse.json({
          show: {
            ...createdShow,
            title: createdShow.name,
            originalTitle: createdShow.originalName,
          },
        });
      }
    }

    return NextResponse.json({ error: 'Тайтл не найден' }, { status: 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch show', details: message },
      { status: 500 }
    );
  }
}