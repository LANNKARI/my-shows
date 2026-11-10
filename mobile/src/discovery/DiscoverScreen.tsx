import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { router } from "expo-router";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Button, Cover, Poster } from "../components";
import { BottomNavigation } from "../navigation";
import { useSocialApi, useTask } from "../social/hooks";
import { Feedback } from "../social/components";
import { colors, styles as s } from "../theme";
type Media = {
  id: number;
  tmdbId: number;
  type: "tv" | "movie";
  title: string;
  posterUrl: string | null;
  backdropUrl?: string | null;
  year: string;
  voteAverage: number;
  overview: string;
  genres: string[];
};
const genres = [
  ["action", "Боевик"],
  ["adventure", "Приключения"],
  ["scifi", "Фантастика"],
  ["fantasy", "Фэнтези"],
  ["comedy", "Комедия"],
  ["drama", "Драма"],
  ["thriller", "Триллер"],
  ["mystery", "Детектив"],
  ["horror", "Ужасы"],
  ["romance", "Мелодрама"],
  ["crime", "Криминал"],
  ["animation", "Мультфильм"],
  ["family", "Семейный"],
  ["war", "Военный"],
  ["documentary", "Документальный"],
  ["history", "История"],
  ["music", "Музыка"],
  ["western", "Вестерн"],
];
export default function DiscoverScreen() {
  const api = useSocialApi(),
    task = useTask();
  const [mode, setMode] = useState<"roulette" | "list">("roulette"),
    [type, setType] = useState("all"),
    [rating, setRating] = useState(7),
    [year, setYear] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [exclude, setExclude] = useState(false),
    [filters, setFilters] = useState(false),
    [items, setItems] = useState<Media[]>([]),
    [searched, setSearched] = useState(false),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [details, setDetails] = useState<Media | null>(null),
    [saved, setSaved] = useState<Record<string, number>>({});
  const key = (item: Media) => `${item.type}:${item.tmdbId}`;
  const change = () => {
    setItems([]);
    setSearched(false);
    setPage(1);
    setHasMore(false);
  };
  async function load(nextPage = 1) {
    const params = new URLSearchParams({
      mode,
      type,
      minRating: String(rating),
      yearFrom: String(year),
      excludeAnimation: String(exclude),
      page: String(nextPage),
      genres: selected.join("|"),
    });
    const data = await api<{
      randomItem?: Media;
      items?: Media[];
      totalResults?: number;
    }>(`/api/random?${params}`);
    const next =
      mode === "roulette"
        ? data.randomItem
          ? [data.randomItem]
          : []
        : data.items || [];
    setItems((old) =>
      nextPage === 1
        ? next
        : [
            ...old,
            ...next.filter(
              (item) => !old.some((value) => key(value) === key(item)),
            ),
          ],
    );
    setSearched(true);
    setPage(nextPage);
    setHasMore(
      mode === "list" &&
        next.length > 0 &&
        nextPage * (type === "all" ? 40 : 20) < (data.totalResults || 0),
    );
  }
  function chip(label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled: !!task.busy }}
        disabled={!!task.busy}
        onPress={onPress}
        style={[s.button, { padding: 10, minHeight: 44 }, !active && s.outline]}
      >
        <Text
          style={{
            color: active ? colors.onAccent : colors.text,
            fontSize: 12,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  async function add(item: Media) {
    const data = await api<{ item: { id: number; status: string } }>(
      "/api/wishlist",
      {
        method: "POST",
        body: JSON.stringify({ tmdbId: item.tmdbId, type: item.type }),
      },
    );
    setSaved((old) => ({ ...old, [key(item)]: data.item.id }));
    return data.item.status === "planned"
      ? "Добавлено в планы"
      : "Тайтл уже в вашей библиотеке";
  }
  function card(item: Media) {
    return (
      <View style={s.panel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Открыть карточку: ${item.title}`}
          onPress={() => setDetails(item)}
          style={[s.row, { alignItems: "flex-start" }]}
        >
          <Poster url={item.posterUrl} title={item.title} />
          <View style={[s.flex, { gap: 6 }]}>
            <Text style={s.heading}>{item.title}</Text>
            <Text style={s.muted}>
              {item.year} · {item.type === "tv" ? "Сериал" : "Фильм"}
            </Text>
            <Text style={{ color: colors.accent }}>
              ★ {item.voteAverage} TMDB
            </Text>
            <Text style={s.muted}>{item.genres?.join(", ")}</Text>
          </View>
        </Pressable>
        <Text numberOfLines={3} style={s.muted}>
          {item.overview}
        </Text>
        {saved[key(item)] ? (
          <Button
            title="Открыть трекер"
            secondary
            onPress={() =>
              router.push({
                pathname: "/title/[id]",
                params: { id: String(saved[key(item)]), from: "discover" },
              })
            }
          />
        ) : (
          <Button
            title={`В планы: ${item.title}`}
            disabled={!!task.busy}
            busy={task.busy === key(item)}
            onPress={() => void task.run(key(item), () => add(item))}
          />
        )}
      </View>
    );
  }
  return (
    <View style={s.flex}>
      <FlatList
        data={items}
        keyExtractor={key}
        renderItem={({ item }) => card(item)}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={{ gap: 15 }}>
            <Text style={s.title}>Что посмотреть</Text>
            <Text style={s.muted}>
              Подбор фильмов и сериалов по твоему вкусу
            </Text>
            <View style={s.row}>
              {chip("Рулетка", mode === "roulette", () => {
                setMode("roulette");
                change();
              })}
              {chip("Подборка", mode === "list", () => {
                setMode("list");
                change();
              })}
            </View>
            <View style={s.row}>
              {[
                ["all", "Все"],
                ["movie", "Фильмы"],
                ["tv", "Сериалы"],
              ].map(([value, label]) =>
                chip(label, type === value, () => {
                  setType(value);
                  change();
                }),
              )}
            </View>
            <Button
              title={filters ? "Свернуть фильтры" : "Фильтры"}
              secondary
              onPress={() => setFilters((value) => !value)}
            />
            {filters && (
              <View style={s.panel}>
                <Text style={s.heading}>Рейтинг TMDB от</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {[0, 6, 7, 7.5, 8, 8.5, 9].map((value) =>
                    chip(
                      value ? `${value}+` : "Любая оценка",
                      rating === value,
                      () => {
                        setRating(value);
                        change();
                      },
                    ),
                  )}
                </View>
                <Text style={s.heading}>Год выхода</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {[0, 2024, 2022, 2020, 2015, 2010, 2000, 1990].map((value) =>
                    chip(
                      value ? `С ${value}` : "Любой год",
                      year === value,
                      () => {
                        setYear(value);
                        change();
                      },
                    ),
                  )}
                </View>
                <Text style={s.heading}>Жанры</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {genres.map(([value, label]) =>
                    chip(label, selected.includes(value), () => {
                      setSelected((old) =>
                        old.includes(value)
                          ? old.filter((v) => v !== value)
                          : [...old, value],
                      );
                      change();
                    }),
                  )}
                </View>
                <View style={s.between}>
                  <Text style={[s.text, s.flex]}>Без аниме и мультфильмов</Text>
                  <Switch
                    accessibilityLabel="Без аниме и мультфильмов"
                    disabled={!!task.busy}
                    value={exclude}
                    onValueChange={(value) => {
                      setExclude(value);
                      change();
                    }}
                  />
                </View>
              </View>
            )}
            <Feedback error={task.error} notice={task.notice} />
            <Button
              title={
                mode === "roulette"
                  ? "Подобрать фильм или сериал"
                  : "Показать подборку"
              }
              busy={task.busy === "load"}
              disabled={!!task.busy}
              onPress={() => void task.run("load", () => load())}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={s.muted}>
            {searched
              ? "По этим фильтрам ничего не найдено. Измени параметры и попробуй снова."
              : "Выбери фильтры и запусти подбор."}
          </Text>
        }
        ListFooterComponent={
          hasMore ? (
            <Button
              title="Показать ещё варианты"
              secondary
              busy={task.busy === "more"}
              disabled={!!task.busy}
              onPress={() => void task.run("more", () => load(page + 1))}
            />
          ) : undefined
        }
      />
      <BottomNavigation active="discover" />
      <Modal
        visible={!!details}
        animationType="slide"
        onRequestClose={() => setDetails(null)}
      >
        <SafeAreaView style={[s.screen, s.flex]}>
          <ScrollView contentContainerStyle={s.content}>
            <Button
              title="Закрыть карточку"
              secondary
              onPress={() => setDetails(null)}
            />
            {details && (
              <>
                <Cover
                  title={details.title}
                  url={details.backdropUrl || details.posterUrl}
                />
                <Text style={s.title}>{details.title}</Text>
                <Text style={s.muted}>
                  {details.year} · ★ {details.voteAverage} TMDB
                </Text>
                <Text style={s.text}>{details.overview}</Text>
                <Button
                  title="Добавить в планы"
                  busy={!!task.busy}
                  onPress={() =>
                    void task.run(key(details), () => add(details))
                  }
                />
                <Feedback error={task.error} notice={task.notice} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
