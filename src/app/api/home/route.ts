import { NextRequest, NextResponse } from 'next/server';
import { formatPosterUrl, safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

// 15 связанных киновселенных
const UNIVERSES_CONFIG = [
  { id: 'marvel', name: 'Marvel (MCU)', icon: '🛡️', collections: [] as number[], companyId: '420' },
  { id: 'dc', name: 'Вселенная DC', icon: '⚡', collections: [209112, 468552, 531242], companyId: '9993' },
  { id: 'harry_potter', name: 'Гарри Поттер', icon: '🪄', collections: [1241, 435259], companyId: '' },
  { id: 'middle_earth', name: 'Средиземье', icon: '💍', collections: [119, 121938], companyId: '' },
  { id: 'star_wars', name: 'Звёздные войны', icon: '⚔️', collections: [10], companyId: '1' },
  { id: 'spider_man', name: 'Человек-паук', icon: '🕷️', collections: [531241, 556, 125574, 573436], companyId: '' },
  { id: 'dark_knight', name: 'Бэтмен / Готэм', icon: '🦇', collections: [263, 948485, 648190, 120794], companyId: '' },
  { id: 'dune', name: 'Вселенная Дюны', icon: '🏜️', collections: [726871], companyId: '' },
  { id: 'john_wick', name: 'Джон Уик', icon: '🔫', collections: [404609], companyId: '' },
  { id: 'x_men', name: 'Люди Икс и Дэдпул', icon: '🧬', collections: [748, 448150, 453993], companyId: '' },
  { id: 'fast_furious', name: 'Форсаж', icon: '🏎️', collections: [9485, 688042], companyId: '' },
  { id: 'pirates', name: 'Пираты Карибского моря', icon: '🏴‍☠️', collections: [295], companyId: '' },
  { id: 'mission_impossible', name: 'Миссия невыполнима', icon: '🕶️', collections: [87359], companyId: '' },
  { id: 'conjuring', name: 'Вселенная Заклятия', icon: '🕯️', collections: [313086, 402074, 968086], companyId: '' },
  { id: 'james_bond', name: 'Агент 007', icon: '🍸', collections: [645], companyId: '' },
];

// 8 культовых режиссёров
const DIRECTORS_CONFIG = [
  { id: 'nolan', name: 'Кристофер Нолан', personId: 525, tag: 'Интеллектуальные блокбастеры' },
  { id: 'ritchie', name: 'Гай Ричи', personId: 956, tag: 'Криминальный драйв и стиль' },
  { id: 'tarantino', name: 'Квентин Тарантино', personId: 138, tag: 'Острые диалоги и культовое кино' },
  { id: 'scorsese', name: 'Мартин Скорсезе', personId: 1032, tag: 'Шедевры драмы и гангстерского кино' },
  { id: 'villeneuve', name: 'Дени Вильнёв', personId: 137427, tag: 'Масштабная научная фантастика' },
  { id: 'fincher', name: 'Дэвид Финчер', personId: 7467, tag: 'Мрачные психологические триллеры' },
  { id: 'spielberg', name: 'Стивен Спилберг', personId: 488, tag: 'Легендарная приключенческая классика' },
  { id: 'cameron', name: 'Джеймс Кэмерон', personId: 2710, tag: 'Эпический размах и технологии' },
];

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

    // Исключаем аниме (жанр 16), а также корейские ('ko') и японские ('ja') релизы
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
        releaseDate: date,
        kind: isTv ? 'series' : 'movie',
        rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
        voteCount: m.vote_count || 0,
        badge: badgeText || null,
      };
    };

    const loadUniverseMovies = async (universeId: string) => {
      const uni = UNIVERSES_CONFIG.find((u) => u.id === universeId) || UNIVERSES_CONFIG[0];
      const map = new Map<number, any>();

      if (uni.collections && uni.collections.length > 0) {
        const colResponses = await Promise.all(
          uni.collections.map((colId) => fetchTmdbJson(`collection/${colId}`))
        );
        for (const col of colResponses) {
          if (col?.parts && Array.isArray(col.parts)) {
            for (const part of col.parts) {
              if (part.poster_path && (part.vote_count > 10 || part.release_date)) {
                map.set(part.id, formatMedia(part, 'movie', uni.name));
              }
            }
          }
        }
      }

      if (uni.companyId) {
        const companyMovies = await fetchTmdbList('discover/movie', {
          with_companies: uni.companyId,
          sort_by: 'popularity.desc',
          'vote_count.gte': 250,
        });
        for (const m of companyMovies) {
          if (m.poster_path && !map.has(m.id)) {
            map.set(m.id, formatMedia(m, 'movie', uni.name));
          }
        }
      }

      const list = Array.from(map.values());
      return list
        .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
        .slice(0, 10);
    };

    const loadDirectorMovies = async (directorId: string) => {
      const dir = DIRECTORS_CONFIG.find((d) => d.id === directorId) || DIRECTORS_CONFIG[0];
      const credits = await fetchTmdbJson(`person/${dir.personId}/movie_credits`);
      const crew: any[] = credits?.crew || [];

      const directedMap = new Map<number, any>();
      for (const item of crew) {
        if (item.job === 'Director' && item.poster_path && (item.vote_count || 0) >= 100) {
          if (!directedMap.has(item.id)) {
            directedMap.set(item.id, item);
          }
        }
      }

      return Array.from(directedMap.values())
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 10)
        .map((m) => formatMedia(m, 'movie', dir.name));
    };

    if (requestedUniverse) {
      const items = await loadUniverseMovies(requestedUniverse);
      return NextResponse.json(safeJson({ items }));
    }

    if (requestedDirector) {
      const items = await loadDirectorMovies(requestedDirector);
      return NextResponse.json(safeJson({ items }));
    }

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
      worldHitsRaw,
      initialUniverseItems,
      initialDirectorItems,
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
      fetchTmdbList('discover/movie', {
        sort_by: 'vote_average.desc',
        'vote_count.gte': 8000,
        without_genres: '16',
        without_original_language: 'ko,ja',
      }),
      loadUniverseMovies(UNIVERSES_CONFIG[0].id),
      loadDirectorMovies(DIRECTORS_CONFIG[0].id),
    ]);

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

    const worldHits = worldHitsRaw
      .filter((m: any) => m.poster_path && isAllowedWesternOrGlobal(m))
      .slice(0, 10)
      .map((m: any) => formatMedia(m, 'movie'));

    return NextResponse.json(
      safeJson({
        heroSlides,
        recentOnline,
        worldHits,
        universesMeta: UNIVERSES_CONFIG.map(({ id, name, icon }) => ({ id, name, icon })),
        directorsMeta: DIRECTORS_CONFIG.map(({ id, name, tag }) => ({ id, name, tag })),
        initialUniverseItems,
        initialDirectorItems,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}