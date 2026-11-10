import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ReactElement } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Episode, LibraryItem, progress } from "../domain";
import { Button } from "../components";
import { Rating, RatingPicker } from "./RatingPicker";
import { colors, styles as s } from "../theme";
type Row = { key: string; season: number; episode?: Episode };
export default function EpisodeList({
  item,
  header,
  refreshControl,
  busy,
  onToggle,
  ratings,
  refreshRatings,
}: {
  item: LibraryItem | undefined;
  header: ReactElement;
  refreshControl: ReactElement;
  busy: boolean;
  onToggle: (episodeId: number) => void;
  ratings: Rating[];
  refreshRatings: () => Promise<void>;
}) {
  const next = item ? progress(item).next : undefined;
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const seasons = useMemo(() => {
    const groups = new Map<number, Episode[]>();
    for (const ep of [...(item?.show.episodes || [])].sort(
      (a, b) => a.season - b.season || a.episode - b.episode,
    )) {
      const values = groups.get(ep.season) || [];
      values.push(ep);
      groups.set(ep.season, values);
    }
    return groups;
  }, [item?.show.episodes]);
  const open = (season: number) =>
    !(
      collapsed[season] ??
      (allCollapsed || season !== (next?.season ?? seasons.keys().next().value))
    );
  const rows: Row[] = [];
  for (const [season, episodes] of seasons) {
    rows.push({ key: `s${season}`, season });
    if (open(season))
      for (const episode of episodes)
        rows.push({ key: `e${episode.id}`, season, episode });
  }
  const watched = new Set(
    item?.progress.filter((p) => p.watched).map((p) => p.episodeId),
  );
  return (
    <FlatList
      data={item?.kind === "movie" ? [] : rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={s.content}
      refreshControl={refreshControl}
      initialNumToRender={14}
      windowSize={7}
      ListHeaderComponent={
        <>
          {header}
          {item?.kind !== "movie" && (
            <View style={s.between}>
              <Text style={[s.heading, s.flex]}>Сезоны и серии</Text>
              <Button
                title="Свернуть всё"
                secondary
                onPress={() => {
                  setAllCollapsed(true);
                  setCollapsed({});
                  setExpanded({});
                }}
              />
            </View>
          )}
        </>
      }
      renderItem={({ item: row }) => {
        if (!row.episode) {
          const eps = seasons.get(row.season) || [];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Сезон ${row.season}`}
              accessibilityState={{ expanded: open(row.season) }}
              onPress={() =>
                setCollapsed((v) => ({ ...v, [row.season]: open(row.season) }))
              }
              style={[s.between, s.panel, { padding: 15 }]}
            >
              <Text style={s.heading}>
                {row.season === 0 ? "Спецвыпуски" : `Сезон ${row.season}`}
              </Text>
              <Text style={s.muted}>
                {eps.filter((e) => watched.has(e.id)).length} / {eps.length}
              </Text>
              <Ionicons
                name={open(row.season) ? "chevron-up" : "chevron-down"}
                color={colors.accent}
                size={18}
              />
            </Pressable>
          );
        }
        const ep = row.episode;
        const label = `Сезон ${ep.season} · серия ${ep.episode}`;
        const score = ratings.find((r) => r.episodeId === ep.id)?.score;
        return (
          <View style={[s.divider, { gap: 10 }]}>
            <View style={s.row}>
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={watched.has(ep.id)}
                accessibilityLabel={label}
                accessibilityState={{
                  checked: watched.has(ep.id),
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => onToggle(ep.id)}
                style={{
                  minWidth: 44,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={
                    watched.has(ep.id) ? "checkmark-circle" : "ellipse-outline"
                  }
                  color={colors.accent}
                  size={25}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Детали серии ${ep.episode}, сезон ${ep.season}`}
                accessibilityState={{ expanded: !!expanded[ep.id] }}
                onPress={() =>
                  setExpanded((v) => ({ ...v, [ep.id]: !v[ep.id] }))
                }
                style={[s.between, s.flex, { minHeight: 48 }]}
              >
                <Text style={[s.text, s.flex]}>{label}</Text>
                {score && (
                  <Text style={{ color: colors.accent }}>★ {score}</Text>
                )}
                <Ionicons
                  name={expanded[ep.id] ? "chevron-up" : "chevron-down"}
                  color={colors.muted}
                  size={18}
                />
              </Pressable>
            </View>
            {expanded[ep.id] && item && (
              <View style={{ paddingLeft: 44, gap: 8 }}>
                <Text style={s.muted}>
                  {watched.has(ep.id) ? "Просмотрено" : "Ещё не просмотрено"}
                </Text>
                <RatingPicker
                  item={item}
                  episodeId={ep.id}
                  ratings={ratings}
                  refresh={refreshRatings}
                />
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        item?.kind !== "movie" ? (
          <Text style={s.muted}>Список серий пока не загружен.</Text>
        ) : undefined
      }
    />
  );
}
