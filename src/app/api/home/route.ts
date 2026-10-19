import { NextResponse } from 'next/server';
import { formatPosterUrl, safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

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
        const res = await fetch(makeTmdbUrl(endpoint, params), {
          headers,
          next: { revalidate: 3600 }, // Автообновление данных каждый час
        });
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
    const fourMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 4)).toISOString().split('T')[0];

    // Параллельная загрузка трендов, онлайна, сериалов и киностудий
    const [trendingRaw, onTheAirTvRaw, recentMoviesRaw, worldHitsRaw, a24Raw, wbRaw, marvelRaw, universalRaw] =
      await Promise.all([
        // 1. Мировые тренды недели (Фильмы + Сериалы одновременно)
        fetchTmdb('trending/all/day'),
        // 2. Сериалы с новыми сериями прямо сейчас (выходящие онгоинги)
        fetchTmdb('tv/on_the_air'),
        // 3. Свежие фильмы в цифровом прокате
        fetchTmdb('discover/movie', {
          sort_by: 'popularity.desc',
          'primary_release_date.lte': today,
          'primary_release_date.gte': fourMonthsAgo,
          'vote_count.gte': 60,
        }),
        // 4. Мировые рейтинговые хиты
        fetchTmdb('movie/top_rated', { page: 1 }),
        // 5. Фильмы топовых студий
        fetchTmdb('discover/movie', { with_companies: STUDIOS.a24.id, sort_by: 'vote_average.desc', 'vote_count.gte': 400 }),
        fetchTmdb('discover/movie', { with_companies: STUDIOS.wb.id, sort_by: 'popularity.desc', 'vote_count.gte': 400 }),
        fetchTmdb('discover/movie', { with_companies: STUDIOS.marvel.id, sort_by: 'popularity.desc', 'vote_count.gte': 400 }),
        fetchTmdb('discover/movie', { with_companies: STUDIOS.universal.id, sort_by: 'popularity.desc', 'vote_count.gte': 400 }),
      ]);

    const formatMedia = (m: any, defaultKind?: 'movie' | 'series', extraStudio?: string) => {
      const isTv = m.media_type === 'tv' || defaultKind === 'series' || Boolean(m.first_air_date);
      const date = m.release_date || m.first_air_date || '';
      return {
        id: m.id,
        title: m.title || m.name || 'Без названия',
        originalTitle: m.original_title || m.original_name || null,
        overview: m.overview || '',
        posterUrl: formatPosterUrl(m.poster_path),
        backdropUrl: m.backdrop_path ? `${TMDB_IMAGE_BASE}${m.backdrop_path}` : null,
        year: date ? date.split('-')[0] : '',
        kind: isTv ? 'series' : 'movie',
        rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
        voteCount: m.vote_count || 0,
        studio: extraStudio || null,
      };
    };

    // Формируем 8 топовых релизов для карусели Hero-баннера (фильмы + сериалы)
    const combinedTrending = [...trendingRaw, ...onTheAirTvRaw];
    const uniqueBannerMap = new Map<number, any>();

    for (const item of combinedTrending) {
      if (item.backdrop_path && item.overview && !uniqueBannerMap.has(item.id)) {
        uniqueBannerMap.set(item.id, item);
      }
      if (uniqueBannerMap.size >= 8) break;
    }

    const heroSlides = Array.from(uniqueBannerMap.values()).map((m) => formatMedia(m));

    // Свежие релизы (смесь фильмов и сериалов, вышедших недавно)
    const recentOnline = [
      ...recentMoviesRaw.map((m: any) => formatMedia(m, 'movie')),
      ...onTheAirTvRaw.map((t: any) => formatMedia(t, 'series')),
    ]
      .filter((m) => m.posterUrl)
      .slice(0, 10);

    const worldHits = worldHitsRaw
      .filter((m: any) => m.poster_path)
      .slice(0, 10)
      .map((m: any) => formatMedia(m, 'movie'));

    const studiosMovies = {
      a24: a24Raw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMedia(m, 'movie', 'A24')),
      wb: wbRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMedia(m, 'movie', 'Warner Bros.')),
      marvel: marvelRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMedia(m, 'movie', 'Marvel')),
      universal: universalRaw.filter((m: any) => m.poster_path).slice(0, 8).map((m: any) => formatMedia(m, 'movie', 'Universal')),
    };

    return NextResponse.json(
      safeJson({
        heroSlides: heroSlides.length > 0 ? heroSlides : recentOnline.slice(0, 6),
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