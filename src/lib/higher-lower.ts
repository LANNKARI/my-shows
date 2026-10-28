import { randomUUID } from "crypto";

export const MAX_DUEL_ATTEMPTS = 5;
export type DuelMovie = {
  id: number;
  title: string;
  posterUrl: string;
  rating: number;
  year: string;
};
export type DuelState = {
  practice?: boolean;
  paidReward?: number;
  id: string;
  day: string;
  round: number;
  bank: number;
  phase: "question" | "answered" | "failed" | "paid";
  leftMovie: DuelMovie;
  rightMovie: DuelMovie;
  usedIds: number[];
};
type TmdbMovie = {
  id: number;
  title: string;
  poster_path: string;
  vote_average: number;
  release_date: string;
};

export function publicDuel(state: DuelState, attempts: number) {
  return {
    roundId: state.id,
    practice: !!state.practice,
    reward: state.paidReward ?? 0,
    practiceAvailable: state.phase === "paid" || state.phase === "failed",
    round: state.round,
    bank: state.bank,
    phase: state.phase,
    limitReached: state.phase === "paid",
    attemptsLeft: Math.max(0, MAX_DUEL_ATTEMPTS - attempts),
    questionType: state.round % 2 ? "rating" : "year",
    rewardForRound: 1,
    leftMovie: state.leftMovie,
    rightMovie:
      state.phase === "question"
        ? {
            id: state.rightMovie.id,
            title: state.rightMovie.title,
            posterUrl: state.rightMovie.posterUrl,
          }
        : state.rightMovie,
  };
}

export function answerDuel(state: DuelState, choice: "higher" | "lower") {
  const left =
    state.round % 2 ? state.leftMovie.rating : Number(state.leftMovie.year);
  const right =
    state.round % 2 ? state.rightMovie.rating : Number(state.rightMovie.year);
  const correct = choice === "higher" ? right >= left : right <= left;
  const bank = correct ? state.bank + 1 : 0;
  return {
    correct,
    state: {
      ...state,
      id: randomUUID(),
      bank,
      phase: !correct ? "failed" : state.round === 5 ? "paid" : "answered",
    } as DuelState,
  };
}

export async function createDuel(
  day: string,
  round = 1,
  bank = 0,
  usedIds: number[] = [],
): Promise<DuelState> {
  const apiKey =
    process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN || "";
  if (!apiKey)
    throw new Error("TMDB не настроен. Подбор фильмов временно недоступен.");
  const pages = [
    Math.floor(Math.random() * 15) + 1,
    Math.floor(Math.random() * 15) + 1,
  ];
  const batches = await Promise.all(
    pages.map(async (page) => {
      const url = new URL("https://api.themoviedb.org/3/discover/movie");
      url.search = new URLSearchParams({
        language: "ru-RU",
        sort_by: "popularity.desc",
        "vote_count.gte": "2500",
        page: String(page),
      }).toString();
      if (!apiKey.startsWith("eyJ")) url.searchParams.set("api_key", apiKey);
      const res = await fetch(url, {
        headers: apiKey.startsWith("eyJ")
          ? { Authorization: `Bearer ${apiKey}` }
          : {},
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok)
        throw new Error("Не удалось загрузить фильмы. Попробуйте позже.");
      const data = await res.json();
      return (data.results || []) as TmdbMovie[];
    }),
  );
  const pool = [
    ...new Map(
      batches
        .flat()
        .filter(
          (m) =>
            m.poster_path &&
            /[а-яА-ЯёЁ]/.test(m.title) &&
            Number.isFinite(m.vote_average) &&
            /^\d{4}-/.test(m.release_date),
        )
        .map((m) => [m.id, m]),
    ).values(),
  ];
  const unused = pool.filter((m) => !usedIds.includes(m.id));
  const active = unused.length >= 2 ? unused : pool;
  if (active.length < 2)
    throw new Error("Не удалось подобрать пару фильмов. Попробуйте позже.");
  const left = active[Math.floor(Math.random() * active.length)];
  const candidates = active.filter((m) => m.id !== left.id);
  const [min, max] =
    round === 1
      ? [1.3, 3]
      : round === 3
        ? [0.45, 0.95]
        : round === 2
          ? [10, 30]
          : round === 4
            ? [3, 8]
            : [0.2, 0.45];
  const value = (m: TmdbMovie) =>
    round % 2 ? m.vote_average : Number(m.release_date.slice(0, 4));
  const suited = candidates.filter((m) => {
    const diff = Math.abs(value(m) - value(left));
    return diff >= min && diff <= max;
  });
  const options = suited.length ? suited : candidates;
  const right = options[Math.floor(Math.random() * options.length)];
  const format = (m: TmdbMovie): DuelMovie => ({
    id: m.id,
    title: m.title,
    posterUrl: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
    rating: Number(m.vote_average.toFixed(1)),
    year: m.release_date.slice(0, 4),
  });
  return {
    id: randomUUID(),
    day,
    round,
    bank,
    phase: "question",
    leftMovie: format(left),
    rightMovie: format(right),
    usedIds: [...usedIds, left.id, right.id],
  };
}
