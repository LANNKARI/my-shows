import { NextResponse } from 'next/server';
import { formatPosterUrl, safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

// Идентификаторы топовых мировых киностудий в TMDB
const STUDIOS = {
  a24: { id: 41077, name: 'A24' },
  wb: { id: 174, name: 'Warner Bros.' },
  marvel: { id: 420, name: 'Marvel Studios' },
  universal: { id: 33, name: 'Universal Pictures' },
};

export async function GET() {
  try {
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const isBearer = apiKey.startsWith('eyJ');
    if (isBearer) headers['Authorization'] = `Bearer ${apiKey}`;

    const makeTmdbUrl = (endpoint: string, params: Record<string, string | number> = {}) => {
      const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
      url.searchParams.set('language', 'ru-RU');
      if (!isBearer && apiKey) url.searchParams.set('api_key', apiKey);
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
      return url.toString();
    };

    const fetchTmdb = async (endpoint: string, params: Record<string, string | number> = {}) => {
      try {
        const res = await fetch(makeTmdbUrl(endpoint, params), { headers, next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const json = await res.json();
        return json.results || [];
      } catch (e) {
        console.error(`TMDB fetch error for ${endpoint}:`, e);
        return [];
      }
    };

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];

    // Параллельная загрузка категорий
    const [recentRaw, hitsRaw, a24Raw, wbRaw, marvelRaw, universalRaw] = await Promise.all([
      // 1. Недавно вышли в онлайне
      fetchTmdb('discover/movie', {
        sort_by: 'popularity.desc',
        'primary_release_date.lte': today,
        'primary_release_date.gte': sixMonthsAgo,
        'vote_count.gte': 80,
      }),
      // 2. Мировые хиты
      fetchTmdb('movie/top_rated', {
        page: 1,
      }),
      // 3. Топовые студии
      fetchTmdb('discover/movie', {
        with_companies: STUDIOS.a24.id,
        sort_by: 'vote_average.desc',
        'vote_count.gte': 500,
      }),
      fetchTmdb('discover/movie', {
        with_companies: STUDIOS.wb.id,
        sort_by: 'popularity.desc',
        'vote_count.gte': 500,
      }),
      fetchTmdb('discover/movie', {
        with_companies: STUDIOS.marvel.id,
        sort_by: 'popularity.desc',
        'vote_count.gte': 500,
      }),
      fetchTmdb('discover/movie', {
        with_companies: STUDIOS.universal.id,
        sort_by: 'popularity.desc',
        'vote_count.gte': 500,
      }),
    ]);

    const formatMovie = (m: any, extraStudio?: string) => ({
      id: m.id,
      title: m.title || m.name || 'Без названия',
      originalTitle: m.original_title || m.original_name || null,
      overview: m.overview || '',
      posterUrl: formatPosterUrl(m.poster_path),
      backdropUrl: m.backdrop_path ? `${TMDB_IMAGE_BASE}${m.backdrop_path}` : null,
      year: m.release_date ? m.release_date.split('-')[0] : '',
      rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
      voteCount: m.vote_count || 0,
      studio: extraStudio || null,
    });

    const recentOnline = recentRaw.filter((m: any) => m.poster_path).slice(0, 10).map((m: any) => formatMovie(m));
    const worldHits = hitsRaw.filter((m: any) => m.poster_path).slice(0, 10).map((m: any) => formatMovie(m));

    const studiosMovies = {
      a24: a24Raw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMovie(m, 'A24')),
      wb: wbRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMovie(m, 'Warner Bros.')),
      marvel: marvelRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMovie(m, 'Marvel Studios')),
      universal: universalRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMovie(m, 'Universal')),
    };

    // Hero-баннер: самый рейтинговый или свежий хит из новинок
    const heroMovie = recentOnline.find((m: any) => m.backdropUrl && m.overview) || recentOnline[0] || worldHits[0] || null;

    return NextResponse.json(
      safeJson({
        heroMovie,
        recentOnline,
        worldHits,
        studiosMovies,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}