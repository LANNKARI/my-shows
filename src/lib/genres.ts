export interface UnifiedGenre {
  key: string;
  name: string;
  movieIds: number[];
  tvIds: number[];
}

export const UNIFIED_GENRES: UnifiedGenre[] = [
  { key: 'action', name: 'Боевик', movieIds: [28], tvIds: [10759] },
  { key: 'adventure', name: 'Приключения', movieIds: [12], tvIds: [10759] },
  { key: 'scifi', name: 'Фантастика', movieIds: [878], tvIds: [10765] },
  { key: 'fantasy', name: 'Фэнтези', movieIds: [14], tvIds: [10765] },
  { key: 'comedy', name: 'Комедия', movieIds: [35], tvIds: [35] },
  { key: 'drama', name: 'Драма', movieIds: [18], tvIds: [18] },
  { key: 'thriller', name: 'Триллер', movieIds: [53], tvIds: [80, 9648] },
  { key: 'mystery', name: 'Детектив', movieIds: [9648], tvIds: [9648] },
  { key: 'horror', name: 'Ужасы', movieIds: [27], tvIds: [9648, 10765] },
  { key: 'romance', name: 'Мелодрама', movieIds: [10749], tvIds: [18, 10766] },
  { key: 'crime', name: 'Криминал', movieIds: [80], tvIds: [80] },
  { key: 'animation', name: 'Мультфильм', movieIds: [16], tvIds: [16, 10762] },
  { key: 'family', name: 'Семейный', movieIds: [10751], tvIds: [10751, 10762] },
  { key: 'war', name: 'Военный', movieIds: [10752], tvIds: [10768] },
  { key: 'documentary', name: 'Документальный', movieIds: [99], tvIds: [99] },
  { key: 'history', name: 'История', movieIds: [36], tvIds: [18, 10768] },
  { key: 'music', name: 'Музыка', movieIds: [10402], tvIds: [10402, 35] },
  { key: 'western', name: 'Вестерн', movieIds: [37], tvIds: [37] },
];

export const GENRE_TRANSLATIONS: Record<string, string> = {
  Action: 'Боевик',
  Adventure: 'Приключения',
  Animation: 'Мультфильм',
  Comedy: 'Комедия',
  Crime: 'Криминал',
  Documentary: 'Документальный',
  Drama: 'Драма',
  Family: 'Семейный',
  Fantasy: 'Фэнтези',
  History: 'История',
  Horror: 'Ужасы',
  Music: 'Музыка',
  Mystery: 'Детектив',
  Romance: 'Мелодрама',
  'Science Fiction': 'Фантастика',
  'Sci-Fi & Fantasy': 'Фантастика и фэнтези',
  'TV Movie': 'Телефильм',
  Thriller: 'Триллер',
  War: 'Военный',
  'War & Politics': 'Война и политика',
  Western: 'Вестерн',
  'Action & Adventure': 'Боевик и приключения',
  Kids: 'Детский',
  News: 'Новости',
  Reality: 'Реалити-шоу',
  Soap: 'Мыльная опера',
  Talk: 'Ток-шоу',
};

export const GENRE_ID_TO_NAME: Record<number, string> = {
  // Movie genres
  28: 'Боевик',
  12: 'Приключения',
  16: 'Мультфильм',
  35: 'Комедия',
  80: 'Криминал',
  99: 'Документальный',
  18: 'Драма',
  10751: 'Семейный',
  14: 'Фэнтези',
  36: 'История',
  27: 'Ужасы',
  10402: 'Музыка',
  9648: 'Детектив',
  10749: 'Мелодрама',
  878: 'Фантастика',
  10770: 'Телефильм',
  53: 'Триллер',
  10752: 'Военный',
  37: 'Вестерн',
  // TV-specific genres
  10759: 'Боевик и приключения',
  10762: 'Детский',
  10763: 'Новости',
  10764: 'Реалити-шоу',
  10765: 'НФ и фэнтези',
  10766: 'Мыльная опера',
  10767: 'Ток-шоу',
  10768: 'Война и политика',
};

export function resolveGenreIds(
  selectedKeys: string[],
  type: 'movie' | 'tv' | 'all'
): { movieIds: number[]; tvIds: number[] } {
  const movieSet = new Set<number>();
  const tvSet = new Set<number>();

  for (const item of selectedKeys) {
    const asNum = Number(item);
    if (!Number.isNaN(asNum) && asNum > 0) {
      movieSet.add(asNum);
      tvSet.add(asNum);
      continue;
    }

    const found = UNIFIED_GENRES.find(
      (g) => g.key.toLowerCase() === item.toLowerCase() || g.name.toLowerCase() === item.toLowerCase()
    );

    if (found) {
      found.movieIds.forEach((id) => movieSet.add(id));
      found.tvIds.forEach((id) => tvSet.add(id));
    }
  }

  return {
    movieIds: Array.from(movieSet),
    tvIds: Array.from(tvSet),
  };
}

export function getGenreNames(ids: number[]): string[] {
  if (!ids || !Array.isArray(ids)) return [];
  return ids
    .map((id) => GENRE_ID_TO_NAME[id])
    .filter((name): name is string => Boolean(name));
}

export function translateGenre(genre: string | number): string {
  if (typeof genre === 'number') {
    return GENRE_ID_TO_NAME[genre] || String(genre);
  }
  const asNum = Number(genre);
  if (!Number.isNaN(asNum) && GENRE_ID_TO_NAME[asNum]) {
    return GENRE_ID_TO_NAME[asNum];
  }
  const clean = String(genre).trim();
  return GENRE_TRANSLATIONS[clean] || clean;
}

export function translateGenres(
  genres?: string | string[] | number[] | { id?: number; name?: string }[] | null | any
): string[] {
  if (!genres) return [];

  let list: string[] = [];

  if (Array.isArray(genres)) {
    list = genres
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number') return GENRE_ID_TO_NAME[item] || String(item);
        if (typeof item === 'object') {
          if (item.name) return String(item.name).trim();
          if (item.id && GENRE_ID_TO_NAME[item.id]) return GENRE_ID_TO_NAME[item.id];
        }
        return '';
      })
      .filter(Boolean);
  } else if (typeof genres === 'string') {
    const trimmed = genres.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return translateGenres(parsed);
        }
      } catch {
        // не JSON
      }
    }
    list = genres.split(/[,|/]/).map((s) => s.trim()).filter(Boolean);
  }

  return list.map((g) => translateGenre(g));
}

export const GENRE_MAP = GENRE_TRANSLATIONS;
export const genreTranslations = GENRE_TRANSLATIONS;
export const GENRES = UNIFIED_GENRES;
export default UNIFIED_GENRES;