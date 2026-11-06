import { addDays } from "./calendar-dates";

export type StatisticsEntry = {
  status: string;
  totalEpisodes: number;
  show: {
    id: number;
    kind: string;
    runtime: number | null;
    year: string | null;
    genres: string[];
    countries: string[];
    episodes: { id: number; season: number }[];
  };
  progress: {
    episodeId: number;
    watched: boolean;
    watchedAt: Date | null;
    statisticsSource: string;
  }[];
  ratings: { score: number; episodeId: number | null; createdAt: Date }[];
};
export type ActivityDay = {
  date: string;
  movies: number;
  episodes: number;
  minutes: number;
  count: number;
  bulk: boolean;
};
const ranked = (values: Map<string, number>) =>
  [...values]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
const increment = (map: Map<string, number>, key: string, amount = 1) =>
  map.set(key, (map.get(key) || 0) + amount);
const weekdayNames = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];
const partNames = ["Ночь", "Утро", "День", "Вечер"];

/** Only verified manual marks have activity dates. Imports and legacy rows still contribute to all-time totals. */
export function viewingStatistics(
  entries: StatisticsEntry[],
  days: number,
  timeZone: string,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const local = (date: Date) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
    };
  };
  const today = local(now).date,
    from = addDays(today, 1 - days),
    heatFrom = addDays(today, -364);
  const genres = new Map<string, number>(),
    countries = new Map<string, number>(),
    years = new Map<string, number>(),
    statuses = new Map<string, number>();
  const events: {
    date: string;
    hour: number;
    minutes: number;
    movie: boolean;
  }[] = [];
  const totals = {
    minutes: 0,
    movieMinutes: 0,
    seriesMinutes: 0,
    movies: 0,
    series: 0,
    completedSeries: 0,
    episodes: 0,
    seasons: 0,
    completedSeasons: 0,
    estimated: 0,
    undated: 0,
    imported: 0,
    legacy: 0,
  };
  const ratings = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: 0,
  }));
  let rated = 0,
    ratingSum = 0;
  for (const entry of entries) {
    const show = entry.show,
      movie = show.kind === "movie",
      canonical = new Map(show.episodes.map((e) => [e.id, e]));
    const seen = new Set<number>();
    const watched = entry.progress.filter((p) => {
      if (!p.watched || !canonical.has(p.episodeId) || seen.has(p.episodeId))
        return false;
      seen.add(p.episodeId);
      return true;
    });
    // A movie is one viewing even if a malformed catalog contains multiple parts.
    const movieRow = movie
      ? [...watched]
          .sort(
            (a, b) =>
              Number(b.statisticsSource === "manual") -
                Number(a.statisticsSource === "manual") ||
              (a.watchedAt?.getTime() ?? Infinity) -
                (b.watchedAt?.getTime() ?? Infinity),
          )
          .slice(0, 1)
      : watched;
    const count = movie
      ? Number(watched.length > 0 || entry.status === "completed")
      : watched.length;
    const duration =
      show.runtime && show.runtime > 0 ? show.runtime : movie ? 110 : 45;
    const minutes = count * duration;
    totals.minutes += minutes;
    if (!show.runtime || show.runtime <= 0) totals.estimated += count;
    increment(
      statuses,
      ["watching", "completed", "planned", "dropped"].includes(entry.status)
        ? entry.status
        : "watching",
    );
    const rating = entry.ratings
      .filter(
        (r) =>
          r.episodeId === null &&
          r.score >= 1 &&
          r.score <= 10 &&
          Number.isInteger(r.score),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (rating) {
      ratings[rating.score - 1].count++;
      rated++;
      ratingSum += rating.score;
    }
    if (count) {
      for (const g of new Set(show.genres)) increment(genres, g);
      for (const c of new Set(show.countries)) increment(countries, c);
      increment(years, show.year?.match(/^\d{4}/)?.[0] || "Не указан");
      if (movie) {
        totals.movies++;
        totals.movieMinutes += minutes;
      } else {
        totals.series++;
        totals.episodes += count;
        totals.seriesMinutes += minutes;
        if (
          canonical.size >= Math.max(entry.totalEpisodes, 1) &&
          watched.length === canonical.size
        )
          totals.completedSeries++;
        const seasonCounts = new Map<
          number,
          { total: number; watched: number }
        >();
        for (const e of show.episodes) {
          if (e.season < 1) continue;
          const s = seasonCounts.get(e.season) || { total: 0, watched: 0 };
          s.total++;
          if (seen.has(e.id)) s.watched++;
          seasonCounts.set(e.season, s);
        }
        for (const s of seasonCounts.values())
          if (s.watched) {
            totals.seasons++;
            if (s.watched === s.total) totals.completedSeasons++;
          }
      }
    }
    if (movie && count && !movieRow.length) totals.undated++;
    for (const p of movieRow) {
      if (!p.watchedAt) totals.undated++;
      if (p.statisticsSource === "import") {
        totals.imported++;
        continue;
      }
      if (p.statisticsSource !== "manual") {
        totals.legacy++;
        continue;
      }
      if (!p.watchedAt || p.watchedAt > now) continue;
      events.push({ ...local(p.watchedAt), minutes: duration, movie });
    }
  }
  const allDays = new Map<string, ActivityDay>();
  for (const event of events) {
    const bin = allDays.get(event.date) || {
      date: event.date,
      movies: 0,
      episodes: 0,
      minutes: 0,
      count: 0,
      bulk: false,
    };
    bin.minutes += event.minutes;
    bin.count++;
    if (event.movie) bin.movies++;
    else bin.episodes++;
    bin.bulk = bin.minutes > 900;
    allDays.set(event.date, bin);
  }
  const fill = (start: string, length: number) =>
    Array.from({ length }, (_, i) => {
      const date = addDays(start, i);
      return (
        allDays.get(date) || {
          date,
          movies: 0,
          episodes: 0,
          minutes: 0,
          count: 0,
          bulk: false,
        }
      );
    });
  const daily = fill(from, days),
    heatmap = fill(heatFrom, 365);
  const valid = daily.filter((d) => !d.bulk),
    cleanMinutes = valid.reduce((a, d) => a + d.minutes, 0),
    bulkDays = daily.length - valid.length;
  const weekdays = new Map<string, number>(),
    parts = new Map<string, number>();
  for (const event of events) {
    if (
      event.date < from ||
      event.date > today ||
      allDays.get(event.date)?.bulk
    )
      continue;
    increment(
      weekdays,
      weekdayNames[new Date(event.date + "T12:00:00Z").getUTCDay()],
      event.minutes,
    );
    increment(parts, partNames[Math.floor(event.hour / 6)], event.minutes);
  }
  const dates = [...allDays.keys()].sort();
  let longest = 0,
    run = 0,
    last = "";
  for (const date of dates) {
    run = last && date === addDays(last, 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = date;
  }
  let current = 0,
    cursor = allDays.has(today) ? today : addDays(today, -1);
  while (allDays.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const monthMap = new Map<string, number>(),
    yearMap = new Map<string, number>();
  for (const [date, day] of allDays) {
    increment(monthMap, date.slice(0, 7), day.minutes);
    increment(yearMap, date.slice(0, 4), day.minutes);
  }
  const latestMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.slice(0, 7) + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 11 + i);
    const name = d.toISOString().slice(0, 7);
    return { name, minutes: monthMap.get(name) || 0 };
  });
  return {
    days,
    timeZone,
    from,
    today,
    totals,
    genres: ranked(genres),
    countries: ranked(countries),
    years: ranked(years).sort((a, b) => a.name.localeCompare(b.name)),
    statuses: Object.fromEntries(statuses),
    ratings: {
      average: rated ? ratingSum / rated : null,
      count: rated,
      distribution: ratings,
    },
    daily,
    heatmap,
    activity: {
      minutes: daily.reduce((a, d) => a + d.minutes, 0),
      cleanMinutes,
      bulkDays,
      eligibleDays: valid.length,
      averageDay: valid.length ? cleanMinutes / valid.length : null,
      averageWeek: valid.length ? (cleanMinutes / valid.length) * 7 : null,
      activeDays: daily.filter((d) => d.count > 0).length,
      currentStreak: current,
      longestStreak: longest,
      favoriteDay: ranked(weekdays)[0]?.name ?? null,
      favoritePart: ranked(parts)[0]?.name ?? null,
      firstDate: dates[0] ?? null,
    },
    monthly: latestMonths,
    yearly: [...yearMap]
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export type ViewingStatistics = ReturnType<typeof viewingStatistics> & {
  percentile: { value: number | null; participants: number; views: number };
};
