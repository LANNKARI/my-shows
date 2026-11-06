# Premium viewing statistics

`GET /api/statistics?days=30|90|365&timeZone=IANA` requires a fresh authenticated Premium account. User IDs in query parameters are ignored. Responses are private/no-store. Only aggregate comparison values leave the ranking query; other users' libraries and identities are never returned.

## Totals and activity

All-time totals use canonical progress only (the episode must belong to the library title). One watched movie counts once, even if its catalog contains multiple parts. A completed legacy movie without progress is included once, with no fabricated activity date. Series count as started after one watched episode; completion requires every canonical episode and no missing expected episodes. A season is started after one episode and completed after all known episodes in that season; season 0 specials count as episodes, not seasons. Future/unavailable episodes are not fabricated.

Minutes sum movie runtime once and series runtime per watched episode. Where runtime is absent/non-positive, estimates are 110/45 minutes respectively, explicitly disclosed in the UI. Current schema has title-level runtime, not per-episode runtime. Rewatch/unmark/remark does not produce additional lifetime viewings: this is a report of current tracked progress, not a playback log.

Genres, countries and release years count each title with at least one viewing once; multi-genre/co-production titles enter each associated category. Genre ring shares are fractions of genre occurrences, not fractions of titles. Personal scores use only the most recent valid title-level rating (1–10), never episode-level ratings. Library status distribution includes all current library titles, including plans.

`EpisodeProgress.statisticsSource` is server-controlled:

- `legacy`: default for historical/unknown-origin data; contributes to totals, never dated activity.
- `import`: always assigned by the import writer, regardless of backup timestamps; contributes to totals, never dated activity.
- `manual`: assigned by the shared writeWatched helper only when newly marking a viewing. Repeated marks preserve previous dates and source. Quick undo restores the previous source, including unwatched imported rows. Old signed undo snapshots default to legacy rather than inventing activity.

No historical dates or totals are deleted by the additive migration. Existing rows default to legacy; source is not accepted from client input. Exported backups do not confer verified activity on import. A manual viewing on an import day is still eligible independently.

All dated activity groups by the validated browser timezone (UTC fallback), including DST. Future/undated marks do not become activity. A day with more than 900 manual minutes is classified as bulk; exactly 900 remains eligible. Imported durations never contribute to the bulk threshold. Bulk days remain in hours, counts, charts, heatmap, and streak. They are excluded entirely from the average numerator/denominator and favorite weekday/time-of-day. Ordinary zero-view days in the selected 30/90/365-day interval remain in the denominator. Weekly average = eligible daily average × 7; no eligible days returns null, displayed as a dash.

Heatmap always shows the last 365 local days. Intensity is by count, not time; bulk days get a gold outline. Current streak ends today or yesterday and can include bulk days. Longest streak uses the complete verified activity history. Favorite weekday and time part are ranked independently by eligible minutes in the selected range. Time part means mark timestamp, not actual playback: 00–06 night, 06–12 morning, 12–18 afternoon, 18–24 evening.

The all-time trend uses verified manual timestamps grouped into the latest 12 calendar months or all available years; it includes bulk marks. The lower activity chart follows the selected range, by days or sequential 7-day bins, with only bulk minutes hatched. Imports and historical unknown-origin data cannot support a trustworthy dated trend.

## Percentile

The SQL ranking aggregates canonical counters: one movie or one series episode is one viewing. Compare against *other* users with at least one viewing. Strictly lower counters count toward the percentile; ties do not. No comparisons, or zero own views, returns null. Percentages are floored to avoid rounding ties up to 100%. No durations affect ranking.

Migration: `20261107000000_viewing_statistics`, SHA256 `5560f0fd6fef8411e3a370bb54f25d26379e512519786c325657aefacbd88c45`. The existing EpisodeProgress RLS remains enabled; access continues through server-side NextAuth/Prisma, with no new public Data API grants or policies.
