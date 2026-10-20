import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const GENRE_MAP: Record<string, number> = {
  'боевик': 28, 'приключения': 12, 'фантастика': 878, 'фэнтези': 14,
  'комедия': 35, 'драма': 18, 'триллер': 53, 'детектив': 9648,
  'ужасы': 27, 'криминал': 80, 'семейный': 10751,
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    let currentUserId = (session?.user as { id?: string })?.id;
    if (!currentUserId && session?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = u?.id;
    }

    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const isBearer = apiKey.startsWith('eyJ');
    if (isBearer) headers['Authorization'] = `Bearer ${apiKey}`;

    const makeTmdbUrl = (endpoint: string, p: Record<string, any> = {}) => {
      const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
      url.searchParams.set('language', 'ru-RU');
      if (!isBearer && apiKey) url.searchParams.set('api_key', apiKey);
      for (const [k, v] of Object.entries(p)) {
        url.searchParams.set(k, String(v));
      }
      return url.toString();
    };

    const fetchTmdb = async (endpoint: string, p: Record<string, any> = {}) => {
      try {
        const res = await fetch(makeTmdbUrl(endpoint, p), { headers, next: { revalidate: 1800 } });
        if (!res.ok) return [];
        const json = await res.json();
        return json.results || [];
      } catch {
        return [];
      }
    };

    const userLibrary = currentUserId
      ? await prisma.userShow.findMany({
          where: { userId: currentUserId },
          include: { show: { select: { tmdbId: true, genres: true } }, ratings: true },
        })
      : [];

    const existingTmdbIds = new Set<number>();
    const genreFrequency: Record<string, number> = {};

    for (const item of userLibrary) {
      if (item.show.tmdbId) existingTmdbIds.add(item.show.tmdbId);
      const weight = (item.ratings?.[0]?.score || 5) >= 7 ? 2 : 1;
      for (const g of item.show.genres || []) {
        const lowerG = g.toLowerCase().trim();
        genreFrequency[lowerG] = (genreFrequency[lowerG] || 0) + weight;
      }
    }

    const sortedGenres = Object.entries(genreFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => GENRE_MAP[g])
      .filter(Boolean);

    const topGenreIds = sortedGenres.slice(0, 2).join(',');

    let recMoviesRaw: any[] = [];
    let recSeriesRaw: any[] = [];

    if (topGenreIds) {
      [recMoviesRaw, recSeriesRaw] = await Promise.all([
        fetchTmdb('discover/movie', { sort_by: 'popularity.desc', with_genres: topGenreIds, 'vote_average.gte': 7.0, 'vote_count.gte': 200, without_genres: '16', without_original_language: 'ko,ja' }),
        fetchTmdb('discover/tv', { sort_by: 'popularity.desc', with_genres: topGenreIds, 'vote_average.gte': 7.0, 'vote_count.gte': 150, without_genres: '16', without_original_language: 'ko,ja' }),
      ]);
    }

    if (recMoviesRaw.length + recSeriesRaw.length < 10) {
      const [topMovies, topTv] = await Promise.all([
        fetchTmdb('discover/movie', { sort_by: 'popularity.desc', 'vote_average.gte': 8.0, 'vote_count.gte': 400, without_genres: '16', without_original_language: 'ko,ja' }),
        fetchTmdb('discover/tv', { sort_by: 'popularity.desc', 'vote_average.gte': 8.0, 'vote_count.gte': 250, without_genres: '16', without_original_language: 'ko,ja' }),
      ]);
      recMoviesRaw = [...recMoviesRaw, ...topMovies];
      recSeriesRaw = [...recSeriesRaw, ...topTv];
    }

    const formatItem = (item: any, defaultKind: 'movie' | 'series') => {
      const isTv = item.media_type === 'tv' || defaultKind === 'series' || Boolean(item.first_air_date);
      const date = item.release_date || item.first_air_date || '';
      return {
        id: item.id,
        title: item.title || item.name || 'Без названия',
        posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
        year: date ? date.split('-')[0] : '',
        kind: isTv ? 'series' : 'movie',
        rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
      };
    };

    const combined: any[] = [];
    const seen = new Set<number>();
    const max = Math.max(recMoviesRaw.length, recSeriesRaw.length);

    for (let i = 0; i < max; i++) {
      if (recMoviesRaw[i]) {
        const m = recMoviesRaw[i];
        if (!existingTmdbIds.has(m.id) && !seen.has(m.id) && m.poster_path) {
          seen.add(m.id);
          combined.push(formatItem(m, 'movie'));
        }
      }
      if (recSeriesRaw[i]) {
        const t = recSeriesRaw[i];
        if (!existingTmdbIds.has(t.id) && !seen.has(t.id) && t.poster_path) {
          seen.add(t.id);
          combined.push(formatItem(t, 'series'));
        }
      }
      if (combined.length >= 15) break;
    }

    return NextResponse.json(safeJson({ recommendations: combined, isPersonalized: Boolean(topGenreIds) }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}