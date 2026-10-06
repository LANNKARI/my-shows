"use client";

type DetailsProps = {
  budget: number | null;
  revenue: number | null;
  countries: string[];
  studios: string[];
  runtime: number | null;
  releaseDate: string | null;
  director: string | null;
  creators: string[];
  tmdbRating: number | null;
  tmdbVotes: number | null;
  kind: string;
};

function formatMoney(value: number | null): string | null {
  if (!value) return null;
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)} млрд`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)} млн`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)} тыс`;
  }
  return `$${value}`;
}

function formatRuntime(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ShowDetails(props: DetailsProps) {
  const {
    budget,
    revenue,
    countries,
    studios,
    runtime,
    releaseDate,
    director,
    creators,
    tmdbRating,
    tmdbVotes,
    kind,
  } = props;

  const rows: { label: string; value: string | null; icon: string }[] = [
    { label: "Режиссёр", value: director, icon: "🎬" },
    {
      label: kind === "series" ? "Создатели" : "Режиссёр",
      value: creators.length > 0 ? creators.join(", ") : null,
      icon: "🎥",
    },
    {
      label: "Страна",
      value: countries.length > 0 ? countries.join(", ") : null,
      icon: "🌍",
    },
    {
      label: "Студии",
      value: studios.length > 0 ? studios.join(", ") : null,
      icon: "🏢",
    },
    {
      label: "Дата выхода",
      value: formatDate(releaseDate),
      icon: "📅",
    },
    {
      label: "Длительность",
      value: formatRuntime(runtime),
      icon: "⏱",
    },
    {
      label: "Бюджет",
      value: formatMoney(budget),
      icon: "💰",
    },
    {
      label: "Сборы",
      value: formatMoney(revenue),
      icon: "💵",
    },
    {
      label: "Рейтинг TMDB",
      value:
        tmdbRating != null
          ? `⭐ ${tmdbRating}${tmdbVotes ? ` (${tmdbVotes.toLocaleString("ru-RU")} голосов)` : ""}`
          : null,
      icon: "⭐",
    },
  ];

  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-neutral-500 font-semibold">
        📋 Детали
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((row) => (
          <div
            key={row.label}
            className="flex items-start gap-3 rounded-xl bg-neutral-900/40 border border-white/5 px-3 py-2.5"
          >
            <span className="text-lg shrink-0">{row.icon}</span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                {row.label}
              </div>
              <div className="text-sm text-neutral-200 break-words">
                {row.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}