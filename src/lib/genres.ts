const GENRE_MAP: Record<string, string> = {
  // Общие
  Action: "Боевик",
  Adventure: "Приключения",
  Animation: "Анимация",
  Comedy: "Комедия",
  Crime: "Криминал",
  Documentary: "Документальный",
  Drama: "Драма",
  Family: "Семейный",
  Fantasy: "Фэнтези",
  History: "История",
  Horror: "Ужасы",
  Music: "Музыка",
  Mystery: "Детектив",
  Romance: "Романтика",
  "Science Fiction": "Фантастика",
  "TV Movie": "ТВ-фильм",
  Thriller: "Триллер",
  War: "Военный",
  Western: "Вестерн",
  // TV-специфичные
  "Action & Adventure": "Боевик и приключения",
  "Sci-Fi & Fantasy": "Фантастика и фэнтези",
  "War & Politics": "Война и политика",
  "Reality": "Реалити-шоу",
  "Talk": "Ток-шоу",
  "News": "Новости",
  "Soap": "Мыльная опера",
  "Kids": "Детский",
};

/**
 * Переводит английское название жанра в русское.
 * Если нет перевода — возвращает оригинал.
 */
export function translateGenre(genre: string): string {
  return GENRE_MAP[genre] || genre;
}

/**
 * Переводит массив жанров.
 */
export function translateGenres(genres: string[]): string[] {
  return genres.map(translateGenre);
}