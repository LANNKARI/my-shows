import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { translateGenres } from '@/lib/genres';

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'TMDB API key is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const rawId = body.tmdbId ?? body.id;
    const mediaType = (body.type || body.mediaType || 'movie') as 'movie' | 'tv';

    if (!rawId) {
      return NextResponse.json({ error: 'Missing tmdbId' }, { status: 400 });
    }

    const numId = Number(rawId);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid tmdbId' }, { status: 400 });
    }

    // 1. Проверяем наличие тайтла в базе по ID или TMDB ID
    const existingShow = await prisma.show.findFirst({
      where: {
        OR: [
          { tmdbId: numId },
          { id: numId },
        ],
      },
    });

    if (existingShow) {
      return NextResponse.json({
        success: true,
        show: {
          ...existingShow,
          title: existingShow.name,
          originalTitle: existingShow.originalName,
        },
        id: existingShow.id,
      });
    }

    // 2. Запрашиваем полные данные у TMDB API
    const endpoint = mediaType === 'tv' ? `tv/${numId}` : `movie/${numId}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let tmdbUrl = `https://api.themoviedb.org/3/${endpoint}?language=ru-RU`;

    if (apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      tmdbUrl += `&api_key=${apiKey}`;
    }

    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) {
      return NextResponse.json(
        { error: `TMDB error: ${tmdbRes.statusText}` },
        { status: tmdbRes.status }
      );
    }

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

    // 3. Создаем запись тайтла в таблице Show
    const newShow = await prisma.show.create({
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
    });

    return NextResponse.json({
      success: true,
      show: {
        ...newShow,
        title: newShow.name,
        originalTitle: newShow.originalName,
      },
      id: newShow.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to import show from TMDB', details: message },
      { status: 500 }
    );
  }
}