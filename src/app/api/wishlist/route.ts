import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, formatPosterUrl } from '@/lib/current-user';
import { translateGenres } from '@/lib/genres';

export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json([]);
    }

    const items = await prisma.userShow.findMany({
      where: {
        userId: currentUserId,
        status: 'planned',
      },
      include: {
        show: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const normalized = items.map((item) => {
      const s = item.show;
      const posterUrl = formatPosterUrl(s?.posterUrl);

      return {
        id: item.id,
        userShowId: item.id,
        showId: item.showId,
        title: s?.name || 'Без названия',
        name: s?.name || 'Без названия',
        originalTitle: s?.originalName,
        posterUrl,
        year: s?.year || (s?.releaseDate ? new Date(s.releaseDate).getFullYear().toString() : ''),
        kind: item.kind || s?.kind || 'movie',
        status: item.status,
        rating: s?.tmdbRating || null,
        genres: s?.genres || [],
        show: {
          ...s,
          posterUrl,
        },
      };
    });

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawShowId = body.showId;
    const rawTmdbId = body.tmdbId;

    const numShowId = rawShowId ? Number(rawShowId) : null;
    const numTmdbId = rawTmdbId ? Number(rawTmdbId) : null;

    let show = numShowId && !isNaN(numShowId)
      ? await prisma.show.findUnique({ where: { id: numShowId } })
      : null;

    if (!show && numTmdbId && !isNaN(numTmdbId)) {
      show = await prisma.show.findFirst({ where: { tmdbId: numTmdbId } });
    }

    if (!show && numTmdbId && !isNaN(numTmdbId)) {
      const apiKey =
        process.env.TMDB_API_KEY ||
        process.env.TMDB_READ_ACCESS_TOKEN ||
        process.env.NEXT_PUBLIC_TMDB_API_KEY ||
        '';

      const mediaType = body.type === 'tv' ? 'tv' : 'movie';
      let tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${numTmdbId}?language=ru-RU`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;
      else tmdbUrl += `&api_key=${apiKey}`;

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
            posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
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
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    const userShow = await prisma.userShow.upsert({
      where: {
        userId_showId: {
          userId: currentUserId,
          showId: show.id,
        },
      },
      update: {
        status: 'planned',
      },
      create: {
        userId: currentUserId,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}