import { NextRequest, NextResponse } from 'next/server';
import { formatPosterUrl, safeJson } from '@/lib/current-user';
import { UNIVERSES_CONFIG, DIRECTORS_CONFIG } from '@/lib/collections-config';

export const dynamic = 'force-dynamic';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUniverse = searchParams.get('universe');
    const requestedDirector = searchParams.get('director');

    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const isBearer = apiKey.startsWith('eyJ');
    if (isBearer) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const makeTmdbUrl = (endpoint: string, params: Record<string, any> = {}) => {
      const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
      url.searchParams.set('language', 'ru-RU');
      if (!isBearer && apiKey) {
        url.searchParams.set('api_key', apiKey);
      }
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
      return url.toString();
    };

    const fetchTmdbJson = async (endpoint: string, params: Record<string, any> = {}) => {
      try {
        const res = await fetch(makeTmdbUrl(endpoint, params), {
          headers,
          next: { revalidate: 1800 },
        });
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.error(`TMDB fetch error for ${endpoint}:`, e);
        return null;
      }
    };

    const fetchTmdbList = async (endpoint: string, params: Record<string, any> = {}) => {
      const json = await fetchTmdbJson(endpoint, params);
      return json?.results || [];
    };

    const isAllowedWesternOrGlobal = (item: any) => {
      const lang = item.original_language || '';
      if (lang === 'ko' || lang === 'ja') return false;
      const genres: number[] = item.genre_ids || [];
      if (genres.includes(16)) return false;
      return true;
    };

    const formatMedia = (m: any, defaultKind?: string, badgeText?: string) => {
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
        releaseDate: date || '1900-01-01',
        kind: isTv ? 'series' : 'movie',
        rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
        voteCount: m.vote_count || 0,
        badge: badgeText || (isTv ? 'Сериал' : 'Фильм'),
      };
    };

    // Сортировка от самых новых к самым старым
    const sortNewestFirst = (items: any[]) => {
      return items.sort((a, b) => {
        const dateA = a.releaseDate || '0000-00-00';
        const dateB = b.releaseDate || '0000-00-00';
        return dateB.localeCompare(dateA);
      });
    };

    // 1. Загрузка полной киновселенной (все фильмы + сериалы)
    if (requestedUniverse) {
      const uni = UNIVERSES_CONFIG.find((u) => u.id === requestedUniverse);
      if (!uni) {
        return NextResponse.json({ error: 'Вселенная не найдена' }, { status: 404 });
      }

      const map = new Map<string, any>();

      // А) Загружаем все кино-коллекции
      if (uni.collections.length > 0) {
        const colResponses = await Promise.all(
          uni.collections.map((colId) => fetchTmdbJson(`collection/${colId}`))
        );
        for (const col of colResponses) {
          if (col?.parts && Array.isArray(col.parts)) {
            for (const part of col.parts) {
              if (part.poster_path) {
                map.set(`movie-${part.id}`, formatMedia(part, 'movie', 'Фильм'));
              }
            }
          }
        }
      }

      // Б) Если есть студия (Marvel, DC, Lucasfilm) — подгружаем страницы фильмов студии
      if (uni.companyId) {
        const [page1, page2] = await Promise.all([
          fetchTmdbList('discover/movie', {
            with_companies: uni.companyId,
            sort_by: 'primary_release_date.desc',
            'vote_count.gte': 50,
            page: 1,
          }),
          fetchTmdbList('discover/movie', {
            with_companies: uni.companyId,
            sort_by: 'primary_release_date.desc',
            'vote_count.gte': 50,
            page: 2,
          }),
        ]);
        for (const m of [...page1, ...page2]) {
          if (m.poster_path && !map.has(`movie-${m.id}`)) {
            map.set(`movie-${m.id}`, formatMedia(m, 'movie', 'Фильм'));
          }
        }
      }

      // В) Загружаем отдельные связанные фильмы
      if (uni.movieIds.length > 0) {
        const movieDetails = await Promise.all(
          uni.movieIds.map((mId) => fetchTmdbJson(`movie/${mId}`))
        );
        for (const m of movieDetails) {
          if (m && m.id && m.poster_path && !map.has(`movie-${m.id}`)) {
            map.set(`movie-${m.id}`, formatMedia(m, 'movie', 'Фильм'));
          }
        }
      }

      // Г) Загружаем все связанные сериалы вселенной
      if (uni.tvIds.length > 0) {
        const tvDetails = await Promise.all(
          uni.tvIds.map((tvId) => fetchTmdbJson(`tv/${tvId}`))
        );
        for (const tv of tvDetails) {
          if (tv && tv.id && tv.poster_path) {
            map.set(`series-${tv.id}`, formatMedia(tv, 'series', 'Сериал'));
          }
        }
      }

      const items = sortNewestFirst(Array.from(map.values()));
      return NextResponse.json(
        safeJson({
          universe: uni,
          items,
        })
      );
    }

    // 2. Загрузка полной фильмографии и сериалов режиссёра
    if (requestedDirector) {
      const dir = DIRECTORS_CONFIG.find((d) => d.id === requestedDirector);
      if (!dir) {
        return NextResponse.json({ error: 'Режиссёр не найден' }, { status: 404 });
      }

      const [movieCredits, tvCredits, personInfo] = await Promise.all([
        fetchTmdbJson(`person/${dir.personId}/movie_credits`),
        fetchTmdbJson(`person/${dir.personId}/tv_credits`),
        fetchTmdbJson(`person/${dir.personId}`),
      ]);

      const map = new Map<string, any>();

      // Фильмы, где персона выступает режиссёром
      const movieCrew: any[] = movieCredits?.crew || [];
      for (const item of movieCrew) {
        if (item.job === 'Director' && item.poster_path && (item.vote_count || 0) >= 20) {
          const key = `movie-${item.id}`;
          if (!map.has(key)) {
            map.set(key, formatMedia(item, 'movie', 'Фильм'));
          }
        }
      }

      // Сериалы из tv_credits
      const tvCrew: any[] = tvCredits?.crew || [];
      for (const item of tvCrew) {
        if (
          (item.job === 'Director' || item.job === 'Creator' || item.job === 'Executive Producer') &&
          item.poster_path &&
          (item.vote_count || 0) >= 30
        ) {
          const key = `series-${item.id}`;
          if (!map.has(key)) {
            map.set(key, formatMedia(item, 'series', 'Сериал'));
          }
        }
      }

      // Знаковые авторские сериалы режиссёра по ID
      if (dir.tvIds.length > 0) {
        const tvDetails = await Promise.all(
          dir.tvIds.map((tvId) => fetchTmdbJson(`tv/${tvId}`))
        );
        for (const tv of tvDetails) {
          if (tv && tv.id && tv.poster_path) {
            map.set(`series-${tv.id}`, formatMedia(tv, 'series', 'Сериал'));
          }
        }
      }

      const items = sortNewestFirst(Array.from(map.values()));
      return NextResponse.json(
        safeJson({
          director: {
            ...dir,
            profileUrl: personInfo?.profile_path
              ? `${TMDB_IMAGE_BASE}${personInfo.profile_path}`
              : null,
          },
          items,
        })
      );
    }

    // 3. Данные для главной страницы
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const fourMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 4)).toISOString().split('T')[0];
    const nextMonth = new Date(new Date().setMonth(now.getMonth() + 1)).toISOString().split('T')[0];

    const [
      trendingWeekRaw,
      topActiveTvRaw,
      topRecentMoviesRaw,
      freshMoviesRaw,
      freshSeriesRaw,
    ] = await Promise.all([
      fetchTmdbList('trending/all/week'),
      fetchTmdbList('discover/tv', {
        sort_by: 'popularity.desc',
        'vote_average.gte': 8.0,
        'vote_count.gte': 300,
        without_genres: '16',
        without_original_language: 'ko,ja',
      }),
      fetchTmdbList('discover/movie', {
        sort_by: 'popularity.desc',
        'vote_average.gte': 8.0,
        'vote_count.gte': 500,
        without_genres: '16',
        without_original_language: 'ko,ja',
      }),
      fetchTmdbList('discover/movie', {
        sort_by: 'popularity.desc',
        'primary_release_date.lte': today,
        'primary_release_date.gte': fourMonthsAgo,
        'vote_count.gte': 80,
        without_genres: '16',
        without_original_language: 'ko,ja',
      }),
      fetchTmdbList('discover/tv', {
        sort_by: 'popularity.desc',
        'air_date.gte': fourMonthsAgo,
        'air_date.lte': nextMonth,
        'vote_count.gte': 100,
        without_genres: '16',
        without_original_language: 'ko,ja',
      }),
    ]);

    // Слайдер Hero-баннера (строго 8.0+, без Кореи и без аниме)
    const bannerCandidates = [
      ...trendingWeekRaw,
      ...topActiveTvRaw.map((t: any) => ({ ...t, media_type: 'tv' })),
      ...topRecentMoviesRaw.map((m: any) => ({ ...m, media_type: 'movie' })),
    ];

    const bannerMap = new Map<number, any>();
    for (const item of bannerCandidates) {
      const score = item.vote_average ? Number(item.vote_average.toFixed(1)) : 0;
      if (
        score >= 8.0 &&
        item.backdrop_path &&
        item.overview &&
        isAllowedWesternOrGlobal(item) &&
        !bannerMap.has(item.id)
      ) {
        bannerMap.set(item.id, formatMedia(item));
      }
      if (bannerMap.size >= 8) break;
    }
    const heroSlides = Array.from(bannerMap.values());

    // Свежие премьеры и сезоны
    const filteredMovies = freshMoviesRaw.filter(isAllowedWesternOrGlobal).map((m: any) => formatMedia(m, 'movie'));
    const filteredSeries = freshSeriesRaw.filter(isAllowedWesternOrGlobal).map((t: any) => formatMedia(t, 'series'));

    const recentOnline: any[] = [];
    const seenRecent = new Set<string>();
    const maxLen = Math.max(filteredMovies.length, filteredSeries.length);

    for (let i = 0; i < maxLen; i++) {
      if (filteredMovies[i]) {
        const key = `movie-${filteredMovies[i].id}`;
        if (!seenRecent.has(key) && filteredMovies[i].posterUrl) {
          seenRecent.add(key);
          recentOnline.push(filteredMovies[i]);
        }
      }
      if (filteredSeries[i]) {
        const key = `series-${filteredSeries[i].id}`;
        if (!seenRecent.has(key) && filteredSeries[i].posterUrl) {
          seenRecent.add(key);
          recentOnline.push(filteredSeries[i]);
        }
      }
      if (recentOnline.length >= 10) break;
    }

    return NextResponse.json(
      safeJson({
        heroSlides,
        recentOnline,
        universes: UNIVERSES_CONFIG,
        directors: DIRECTORS_CONFIG,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}