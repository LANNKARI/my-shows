import { NextRequest, NextResponse } from 'next/server';
import { resolveGenreIds, getGenreNames } from '@/lib/genres';

interface TmdbRawItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  popularity?: number;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey =
      process.env.TMDB_API_KEY ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'TMDB API key is not configured in environment variables' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);

    const type = (searchParams.get('type') || 'all') as 'all' | 'movie' | 'tv';
    const genresParam = searchParams.get('genres') || '';
    const yearFrom = parseInt(searchParams.get('yearFrom') || '0', 10);
    const yearTo = parseInt(searchParams.get('yearTo') || '0', 10);
    const minRating = parseFloat(searchParams.get('minRating') || '0');
    const sortBy = searchParams.get('sortBy') || 'popularity.desc';
    const mode = (searchParams.get('mode') || 'roulette') as 'roulette' | 'list';
    const requestedPage = parseInt(searchParams.get('page') || '1', 10);
    const excludeAnimation = searchParams.get('excludeAnimation') === 'true';

    const genreKeys = genresParam
      ? genresParam.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const { movieIds, tvIds } = resolveGenreIds(genreKeys, type);

    // Адаптивный порог голосов
    let voteCountGte = 50;
    if (minRating >= 9.0) {
      voteCountGte = 10;
    } else if (minRating >= 8.5) {
      voteCountGte = 40;
    } else if (minRating >= 8.0) {
      voteCountGte = 80;
    } else if (minRating >= 7.0) {
      voteCountGte = 120;
    } else if (minRating === 0) {
      voteCountGte = 30;
    }

    const buildTmdbParams = (mediaType: 'movie' | 'tv', pageNumber: number) => {
      const params = new URLSearchParams({
        language: 'ru-RU',
        include_adult: 'false',
        page: pageNumber.toString(),
        sort_by: sortBy,
      });

      if (!apiKey.startsWith('eyJ')) {
        params.set('api_key', apiKey);
      }

      if (minRating > 0) {
        params.set('vote_average.gte', minRating.toString());
      }

      params.set('vote_count.gte', voteCountGte.toString());

      // Логика OR для жанров
      if (mediaType === 'movie' && movieIds.length > 0) {
        params.set('with_genres', movieIds.join('|'));
      } else if (mediaType === 'tv' && tvIds.length > 0) {
        params.set('with_genres', tvIds.join('|'));
      }

      // Исключение аниме и мультиков (жанр 16 - Animation)
      if (excludeAnimation) {
        params.set('without_genres', '16');
      }

      // Даты выхода
      if (mediaType === 'movie') {
        if (yearFrom > 0) params.set('primary_release_date.gte', `${yearFrom}-01-01`);
        if (yearTo > 0) params.set('primary_release_date.lte', `${yearTo}-12-31`);
      } else {
        if (yearFrom > 0) params.set('first_air_date.gte', `${yearFrom}-01-01`);
        if (yearTo > 0) params.set('first_air_date.lte', `${yearTo}-12-31`);
      }

      return params;
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const fetchFromTmdb = async (mediaType: 'movie' | 'tv', pageNumber: number) => {
      const endpoint = mediaType === 'movie' ? 'discover/movie' : 'discover/tv';
      const query = buildTmdbParams(mediaType, pageNumber);
      const url = `https://api.themoviedb.org/3/${endpoint}?${query.toString()}`;

      const res = await fetch(url, { headers, next: { revalidate: 60 } });
      if (!res.ok) {
        throw new Error(`TMDB error ${res.status}: ${await res.text()}`);
      }
      return res.json();
    };

    const normalize = (item: TmdbRawItem, mediaType: 'movie' | 'tv') => {
      const rawDate = item.release_date || item.first_air_date || '';
      const year = rawDate ? rawDate.split('-')[0] : '—';
      const title = item.title || item.name || 'Без названия';
      const originalTitle = item.original_title || item.original_name || '';

      return {
        id: item.id,
        tmdbId: item.id,
        type: mediaType,
        title,
        originalTitle,
        overview: item.overview || 'Описание на русском языке пока отсутствует.',
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        backdropUrl: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        releaseDate: rawDate,
        year,
        voteAverage: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 0,
        voteCount: item.vote_count || 0,
        popularity: item.popularity || 0,
        genreIds: item.genre_ids || [],
        genres: getGenreNames(item.genre_ids || []),
      };
    };

    // 1. РЕЖИМ РУЛЕТКИ
    if (mode === 'roulette') {
      const targetType: 'movie' | 'tv' =
        type === 'all' ? (Math.random() > 0.5 ? 'movie' : 'tv') : type;

      const firstPageData = await fetchFromTmdb(targetType, 1);
      const totalPages = Math.min(firstPageData.total_pages || 1, 20);
      let results: TmdbRawItem[] = firstPageData.results || [];

      if (totalPages > 1) {
        const randomPage = Math.floor(Math.random() * totalPages) + 1;
        if (randomPage !== 1) {
          try {
            const pageData = await fetchFromTmdb(targetType, randomPage);
            if (pageData.results && pageData.results.length > 0) {
              results = pageData.results;
            }
          } catch {
            // Фолбэк на результаты первой страницы
          }
        }
      }

      // Дополнительная клиентская фильтрация от мультиков/аниме (если TMDB вернул тег 16)
      if (excludeAnimation) {
        results = results.filter((item) => !item.genre_ids?.includes(16));
      }

      if (results.length === 0 && type === 'all') {
        const fallbackType = targetType === 'movie' ? 'tv' : 'movie';
        const fallbackData = await fetchFromTmdb(fallbackType, 1);
        results = fallbackData.results || [];
        if (excludeAnimation) {
          results = results.filter((item) => !item.genre_ids?.includes(16));
        }
        if (results.length > 0) {
          const randomItem = results[Math.floor(Math.random() * results.length)];
          return NextResponse.json({
            success: true,
            randomItem: normalize(randomItem, fallbackType),
            totalResults: fallbackData.total_results || 0,
          });
        }
      }

      if (results.length === 0) {
        return NextResponse.json({
          success: true,
          randomItem: null,
          totalResults: 0,
          message:
            'По выбранным фильтрам ничего не найдено. Попробуйте немного смягчить параметры поиска.',
        });
      }

      const randomItem = results[Math.floor(Math.random() * results.length)];

      return NextResponse.json({
        success: true,
        randomItem: normalize(randomItem, targetType),
        totalResults: firstPageData.total_results || 0,
      });
    }

    // 2. РЕЖИМ ПОДБОРКИ (СПИСОК)
    let combinedItems: ReturnType<typeof normalize>[] = [];
    let totalResults = 0;

    if (type === 'all') {
      const [moviesData, tvData] = await Promise.all([
        fetchFromTmdb('movie', requestedPage),
        fetchFromTmdb('tv', requestedPage),
      ]);

      let normMovies = (moviesData.results || []).map((m: TmdbRawItem) => normalize(m, 'movie'));
      let normTv = (tvData.results || []).map((t: TmdbRawItem) => normalize(t, 'tv'));

      if (excludeAnimation) {
        normMovies = normMovies.filter((item: ReturnType<typeof normalize>) => !item.genreIds.includes(16));
        normTv = normTv.filter((item: ReturnType<typeof normalize>) => !item.genreIds.includes(16));
      }

      combinedItems = [...normMovies, ...normTv];
      if (sortBy.includes('vote_average')) {
        combinedItems.sort((a, b) => b.voteAverage - a.voteAverage);
      } else {
        combinedItems.sort((a, b) => b.popularity - a.popularity);
      }
      totalResults = (moviesData.total_results || 0) + (tvData.total_results || 0);
    } else {
      const data = await fetchFromTmdb(type, requestedPage);
      let results: TmdbRawItem[] = data.results || [];
      if (excludeAnimation) {
        results = results.filter((item) => !item.genre_ids?.includes(16));
      }
      combinedItems = results.map((item) => normalize(item, type));
      totalResults = data.total_results || 0;
    }

    return NextResponse.json({
      success: true,
      items: combinedItems,
      totalResults,
      page: requestedPage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: message },
      { status: 500 }
    );
  }
}