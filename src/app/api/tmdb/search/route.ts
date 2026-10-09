import { NextRequest, NextResponse } from 'next/server';

interface TmdbSearchRaw {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  media_type?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=ru-RU&include_adult=false`;

    if (apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      url += `&api_key=${apiKey}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: 'TMDB search error' }, { status: res.status });
    }

    const data = await res.json();
    const rawResults: TmdbSearchRaw[] = data.results || [];

    // Отсекаем персон (актеров/режиссеров), оставляем только фильмы и сериалы
    const filtered = rawResults
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 10)
      .map((item) => {
        const releaseDate = item.release_date || item.first_air_date || '';
        const year = releaseDate ? releaseDate.slice(0, 4) : '';
        const title = item.title || item.name || 'Без названия';
        const originalTitle = item.original_title || item.original_name || '';

        return {
          id: item.id,
          tmdbId: item.id,
          showId: item.id,
          title,
          name: title,
          originalTitle,
          originalName: originalTitle,
          type: item.media_type,
          media_type: item.media_type,
          kind: item.media_type === 'tv' ? 'series' : 'movie',
          year,
          posterUrl: item.poster_path
            ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
            : null,
          rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0,
        };
      });

    return NextResponse.json({ results: filtered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}