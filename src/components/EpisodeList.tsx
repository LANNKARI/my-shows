"use client";

import { useState } from "react";
import RatingModal from "./RatingModal";

type Episode = {
  id: number;
  season: number;
  episode: number;
  watched: boolean;
  stoppedAt: string | null;
};

export default function EpisodeList({
  titleId,
  episodes,
  onChanged,
}: {
  titleId: number;
  episodes: Episode[];
  onChanged: () => void;
}) {
  const [ratingFor, setRatingFor] = useState<number | null>(null);

  const seasons = Array.from(new Set(episodes.map((e) => e.season))).sort(
    (a, b) => a - b
  );

  // Первый сезон, в котором есть непросмотренные серии — раскрыт по умолчанию
  const firstIncompleteSeason =
    seasons.find((s) =>
      episodes.filter((e) => e.season === s).some((e) => !e.watched)
    ) ?? seasons[0];

  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    new Set(firstIncompleteSeason != null ? [firstIncompleteSeason] : [])
  );

  function toggleSeason(s: number) {
    setOpenSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function expandAll() {
    setOpenSeasons(new Set(seasons));
  }
  function collapseAll() {
    setOpenSeasons(new Set());
  }

  async function patchEp(ep: Episode, data: Partial<Episode>) {
    await fetch(`/api/titles/${titleId}/episodes/${ep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function toggleWatched(ep: Episode) {
    const willWatch = !ep.watched;
    await patchEp(ep, { watched: willWatch });
    onChanged();
    if (willWatch) setRatingFor(ep.id);
  }

  return (
    <div className="space-y-3">
      {/* Кнопки "развернуть/свернуть всё" */}
      {seasons.length > 1 && (
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            Развернуть все
          </button>
          <span className="text-neutral-700">·</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            Свернуть все
          </button>
        </div>
      )}

      {seasons.map((s) => {
        const seasonEps = episodes.filter((e) => e.season === s);
        const seasonWatched = seasonEps.filter((e) => e.watched).length;
        const isOpen = openSeasons.has(s);
        const allWatched = seasonWatched === seasonEps.length;
        const progress = (seasonWatched / seasonEps.length) * 100;

        return (
          <div
            key={s}
            className="rounded-xl border border-white/5 bg-neutral-900/40 overflow-hidden transition-colors hover:border-white/10"
          >
            {/* Заголовок-аккордеон */}
            <button
              type="button"
              onClick={() => toggleSeason(s)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
            >
              {/* Стрелка */}
              <span
                className={`text-neutral-500 transition-transform duration-200 shrink-0 ${
                  isOpen ? "rotate-90" : "rotate-0"
                }`}
              >
                ▶
              </span>

              {/* Название сезона */}
              <span className="text-sm font-semibold tracking-wide">
                Сезон {s}
              </span>

              {/* Бейдж "завершён" */}
              {allWatched && (
                <span className="badge badge-green text-[10px] px-2 py-0.5">
                  ✓ Завершён
                </span>
              )}

              <div className="ml-auto flex items-center gap-3">
                {/* Мини-прогресс-бар */}
                <div className="hidden sm:block w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-500 tabular-nums shrink-0">
                  {seasonWatched} / {seasonEps.length}
                </span>
              </div>
            </button>

            {/* Список серий — плавно раскрывается/сворачивается */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-3 pb-3 pt-3 border-t border-white/5 space-y-2">
                  {seasonEps.map((ep) => (
                    <div
                      key={ep.id}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                        ep.watched
                          ? "bg-emerald-950/20 border-emerald-900/40"
                          : "bg-neutral-900/60 border-white/5 hover:border-white/10 hover:bg-neutral-900"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleWatched(ep)}
                        className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold transition-all ${
                          ep.watched
                            ? "bg-gradient-to-b from-emerald-500 to-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                            : "border-white/15 hover:border-white/40 text-transparent hover:text-white/40"
                        }`}
                        aria-label="Отметить просмотренной"
                      >
                        ✓
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            ep.watched
                              ? "text-neutral-400 line-through decoration-neutral-600"
                              : "text-neutral-100"
                          }`}
                        >
                          S{String(ep.season).padStart(2, "0")}E
                          {String(ep.episode).padStart(2, "0")}
                        </div>
                      </div>

                      <input
                        className="input max-w-[140px] text-xs py-1.5"
                        placeholder="00:34:12"
                        value={ep.stoppedAt ?? ""}
                        onChange={async (e) => {
                          await patchEp(ep, { stoppedAt: e.target.value });
                        }}
                      />

                      <button
                        className="btn btn-secondary text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setRatingFor(ep.id)}
                        type="button"
                      >
                        ⭐
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {ratingFor != null && (
        <RatingModal
          titleId={titleId}
          episodeId={ratingFor}
          onClose={() => setRatingFor(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}