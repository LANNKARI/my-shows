import {
  router,
  usePathname,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ApiError, request, Session } from "./api";
import { Button, Cover, LibraryRow, ProgressBar } from "./components";
import { canMark, LibraryItem, progress, statuses } from "./domain";
import { colors, styles as s } from "./theme";

type Tab = "home" | "search" | "library" | "calendar" | "profile";
const tabs: {
  id: Tab;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "home", label: "Главная", icon: "home-outline" },
  { id: "search", label: "Поиск", icon: "search-outline" },
  { id: "library", label: "Библиотека", icon: "library-outline" },
  { id: "calendar", label: "Календарь", icon: "calendar-outline" },
  { id: "profile", label: "Профиль", icon: "person-outline" },
];
type Undo = { token: string; expiresAt: number; id: number };
type CalendarData = {
  events: {
    id: number;
    showId: number;
    title: string;
    date: string;
    season: number;
    episode: number;
    watched: boolean;
  }[];
  syncIds: number[];
  truncated: boolean;
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить действие";

export default function Dashboard({
  session,
  onLogout,
  onExpired,
}: {
  session: Session;
  onLogout: () => Promise<void>;
  onExpired: () => Promise<void>;
}) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ id?: string; from?: string }>();
  const selected =
    pathname.startsWith("/title/") && /^\d+$/.test(params.id || "")
      ? Number(params.id)
      : null;
  const tab: Tab =
    selected !== null
      ? tabs.find((t) => t.id === params.from)?.id || "library"
      : tabs.find((t) => `/${t.id}` === pathname)?.id || "home";
  function setTab(value: Tab) {
    router.replace(value === "home" ? "/" : `/${value}`);
  }
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace("/library");
  }
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [status, setStatus] = useState("watching");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const loadId = useRef(0);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [notice, setNotice] = useState("");
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const api = useCallback(
    <T,>(path: string, init?: RequestInit) =>
      request<T>(path, session.token, init),
    [session.token],
  );
  const handleError = useCallback(
    async (e: unknown) => {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 401) {
        try {
          await onExpired();
        } catch {
          setError(
            "Не удалось очистить сессию на устройстве. Повторите вход после перезапуска.",
          );
        }
      } else setError(message(e));
    },
    [onExpired],
  );
  const reload = useCallback(
    async (clearError = true) => {
      const version = ++loadId.current;
      setLoading(true);
      if (clearError) setError("");
      try {
        const data = await api<LibraryItem[]>("/api/user-shows?status=library");
        if (mounted.current && version === loadId.current) {
          setItems(data);
          setLoaded(true);
        }
      } catch (e) {
        if (version === loadId.current) await handleError(e);
      } finally {
        if (mounted.current && version === loadId.current) setLoading(false);
      }
    },
    [api, handleError],
  );
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      void reload();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void reload();
      });
      return () => {
        mounted.current = false;
        listener.remove();
      };
    }, [reload]),
  );
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError("");
    const now = new Date();
    const localDay = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    try {
      const data = await api<CalendarData>(
        `/api/calendar?from=${localDay(now)}&to=${localDay(end)}&status=all`,
      );
      if (mounted.current) setCalendar(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await handleError(e);
      else if (mounted.current) setCalendarError(message(e));
    } finally {
      if (mounted.current) setCalendarLoading(false);
    }
  }, [api, handleError]);
  useEffect(() => {
    if (tab === "calendar") void loadCalendar();
  }, [tab, loadCalendar]);
  async function mutate(item: LibraryItem, action: "mark" | "undo") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    // Ignore library reads started before the mutation; always read its final state.
    loadId.current++;
    try {
      const data = await api<{
        undoToken?: string;
        undoExpiresAt?: number;
        message: string;
      }>(`/api/user-shows/${item.userShowId}/quick-progress`, {
        method: "POST",
        body: JSON.stringify(
          action === "undo"
            ? { action, token: undo?.token }
            : {
                action,
                expectedUpdatedAt: item.updatedAt,
                expectedEpisodeId: progress(item).next?.id,
              },
        ),
      });
      if (!mounted.current) return;
      setNotice(data.message);
      setUndo(
        data.undoToken && data.undoExpiresAt
          ? {
              token: data.undoToken,
              expiresAt: data.undoExpiresAt,
              id: item.userShowId,
            }
          : null,
      );
    } catch (e) {
      await handleError(e);
    } finally {
      if (mounted.current) {
        await reload(false);
        setBusy(false);
      }
      lock.current = false;
    }
  }
  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/mobile/session", { method: "DELETE" });
      await onLogout();
    } catch (e) {
      await handleError(e);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const current = items.find((item) => item.userShowId === selected);
  const watching = items.filter((item) => item.status === "watching");
  const filtered = items.filter((item) =>
    tab === "search"
      ? item.title
          .toLocaleLowerCase("ru")
          .includes(query.trim().toLocaleLowerCase("ru"))
      : item.status === status,
  );
  const undoItem = undo && items.find((item) => item.userShowId === undo.id);
  const refresh = (
    <RefreshControl
      refreshing={loading}
      onRefresh={() => void reload()}
      tintColor={colors.accent}
    />
  );
  function open(item: LibraryItem) {
    setError("");
    router.push({
      pathname: "/title/[id]",
      params: { id: String(item.userShowId), from: tab },
    });
  }
  function row(item: LibraryItem) {
    return (
      <LibraryRow key={item.userShowId} item={item} onOpen={() => open(item)} />
    );
  }
  return (
    <View style={s.flex}>
      {!!error && (
        <View style={{ padding: 16, gap: 8 }}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Button
            title="Обновить библиотеку"
            secondary
            onPress={() => void reload()}
            busy={loading}
          />
        </View>
      )}
      {!!notice && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}>
          <Text accessibilityLiveRegion="polite" style={s.badge}>
            {notice}
          </Text>
          {undoItem && (
            <Button
              title="Отменить отметку"
              secondary
              busy={busy}
              onPress={() => void mutate(undoItem, "undo")}
            />
          )}
        </View>
      )}
      {selected !== null ? (
        <ScrollView contentContainerStyle={s.content} refreshControl={refresh}>
          <Button title="Назад" secondary onPress={back} />
          {loading && !loaded ? (
            <ActivityIndicator color={colors.accent} />
          ) : current ? (
            <>
              <Cover url={current.posterUrl} title={current.title} />
              <View>
                <Text style={s.title}>{current.title}</Text>
                <Text style={s.muted}>
                  {current.kind === "movie" ? "Фильм" : "Сериал"}
                  {current.year ? ` · ${current.year}` : ""}
                </Text>
                <Text style={s.badge}>
                  {statuses.find((v) => v.value === current.status)?.label}
                </Text>
              </View>
              <View style={s.panel}>
                <Text style={s.heading}>Твой прогресс</Text>
                <ProgressBar item={current} />
                {canMark(current) && (
                  <Button
                    title={
                      current.kind === "movie"
                        ? "Отметить фильм"
                        : "Отметить следующую серию"
                    }
                    busy={busy}
                    disabled={loading}
                    onPress={() => void mutate(current, "mark")}
                  />
                )}
              </View>
              <Text style={s.heading}>Серии</Text>
              {[...current.show.episodes]
                .sort((a, b) => a.season - b.season || a.episode - b.episode)
                .map((episode) => (
                  <View key={episode.id} style={[s.between, s.divider]}>
                    <Text style={s.text}>
                      Сезон {episode.season} · серия {episode.episode}
                    </Text>
                    <Ionicons
                      name={
                        current.progress.some(
                          (p) => p.episodeId === episode.id && p.watched,
                        )
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                ))}
              {!current.show.episodes.length && (
                <Text style={s.muted}>Список серий пока не загружен.</Text>
              )}
            </>
          ) : (
            <Text style={s.muted}>
              Запись больше не найдена в библиотеке. Вернись к списку и обнови
              его.
            </Text>
          )}
        </ScrollView>
      ) : tab === "library" || tab === "search" ? (
        <FlatList
          data={loaded ? filtered : []}
          keyExtractor={(item) => String(item.userShowId)}
          renderItem={({ item }) => row(item)}
          contentContainerStyle={s.content}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <Text style={s.title}>
                {tab === "search" ? "Поиск в библиотеке" : "Твои истории"}
              </Text>
              {tab === "search" ? (
                <>
                  <Text style={s.muted}>
                    Поиск среди сохранённых фильмов и сериалов
                  </Text>
                  <TextInput
                    accessibilityLabel="Название в библиотеке"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Название фильма или сериала"
                    placeholderTextColor={colors.muted}
                    style={s.input}
                  />
                </>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {statuses.map((v) => (
                    <Pressable
                      key={v.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: status === v.value }}
                      onPress={() => setStatus(v.value)}
                      style={[s.button, status !== v.value && s.outline]}
                    >
                      <Text
                        style={[
                          s.buttonText,
                          status !== v.value && { color: colors.muted },
                        ]}
                      >
                        {v.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={s.muted}>
                {loaded
                  ? tab === "search"
                    ? "Ничего не найдено"
                    : "В этом разделе пока нет фильмов и сериалов"
                  : "Не удалось загрузить библиотеку"}
              </Text>
            )
          }
        />
      ) : tab === "profile" ? (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.title}>Профиль</Text>
          <View style={s.panel}>
            <Text style={s.heading}>
              {session.user.name || session.user.username}
            </Text>
            <Text style={s.muted}>@{session.user.username}</Text>
            <Text style={s.text}>
              Один аккаунт с EpisyHub. Библиотека и прогресс сохраняются на
              сервере сайта.
            </Text>
            <Text style={s.muted}>
              Сессия действует до{" "}
              {new Date(session.expiresAt).toLocaleDateString("ru-RU")}. После
              истечения потребуется повторный вход.
            </Text>
          </View>
          <Button
            title="Выйти из аккаунта"
            secondary
            busy={busy}
            onPress={() => void logout()}
          />
        </ScrollView>
      ) : tab === "calendar" ? (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl
              refreshing={calendarLoading}
              onRefresh={() => void loadCalendar()}
              tintColor={colors.accent}
            />
          }
        >
          <Text style={s.title}>Календарь</Text>
          <Text style={s.muted}>
            Серии из твоей библиотеки на ближайшие 30 дней
          </Text>
          {!!calendarError && (
            <>
              <Text style={s.error}>{calendarError}</Text>
              <Button title="Повторить" onPress={() => void loadCalendar()} />
            </>
          )}
          {calendarLoading && !calendar && (
            <ActivityIndicator color={colors.accent} />
          )}{" "}
          {!!calendar?.syncIds.length && (
            <Text style={s.muted}>
              Для части сериалов расписание требует обновления на сайте. Здесь
              показаны сохранённые даты.
            </Text>
          )}
          {calendar?.events.map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              onPress={() => {
                const item = items.find((v) => v.showId === event.showId);
                if (item) open(item);
              }}
              style={[s.panel, { gap: 8 }]}
            >
              <Text style={s.badge}>
                {new Date(event.date + "T12:00:00").toLocaleDateString(
                  "ru-RU",
                  { day: "numeric", month: "long" },
                )}
                {event.watched ? " · Просмотрено" : ""}
              </Text>
              <Text style={s.heading}>{event.title}</Text>
              <Text style={s.muted}>
                Сезон {event.season} · серия {event.episode}
              </Text>
            </Pressable>
          ))}
          {calendar && !calendar.events.length && (
            <Text style={s.muted}>
              На этот период нет сохранённых дат выхода.
            </Text>
          )}
          {calendar?.truncated && (
            <Text style={s.muted}>
              Показана часть событий. Полное расписание доступно на сайте.
            </Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.content} refreshControl={refresh}>
          <Text style={[s.heading, { fontSize: 25 }]}>
            Episy<Text style={{ color: colors.accent }}>Hub</Text>
          </Text>
          <View style={{ gap: 7 }}>
            <Text style={s.title}>Что посмотрим?</Text>
            <Text style={s.muted}>Твои сериалы и фильмы в одном месте</Text>
          </View>
          <Text style={s.heading}>Продолжить просмотр</Text>
          {loading && !loaded ? (
            <ActivityIndicator color={colors.accent} />
          ) : watching[0] ? (
            <View style={s.panel}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Открыть ${watching[0].title}`}
                onPress={() => open(watching[0])}
              >
                <Cover url={watching[0].posterUrl} title={watching[0].title} />
              </Pressable>
              <Text style={s.muted}>
                {progress(watching[0]).next
                  ? `Сезон ${progress(watching[0]).next!.season} · серия ${progress(watching[0]).next!.episode}`
                  : "Смотрю"}
              </Text>
              <ProgressBar item={watching[0]} />
              {canMark(watching[0]) && (
                <Button
                  title={
                    watching[0].kind === "movie"
                      ? "Отметить фильм"
                      : "Отметить серию"
                  }
                  busy={busy}
                  disabled={loading}
                  onPress={() => void mutate(watching[0], "mark")}
                />
              )}
            </View>
          ) : (
            <Text style={s.muted}>
              {loaded
                ? "Здесь появятся тайтлы со статусом «Смотрю»."
                : "Обнови библиотеку, чтобы загрузить данные."}
            </Text>
          )}
          {watching.slice(1, 4).map(row)}
          <Text style={s.heading}>В твоих планах</Text>
          {items
            .filter((item) => item.status === "planned")
            .slice(0, 4)
            .map(row)}
          {loaded && !items.some((item) => item.status === "planned") && (
            <Text style={s.muted}>
              Добавь фильмы и сериалы в планы на сайте — они появятся здесь
              после обновления.
            </Text>
          )}
        </ScrollView>
      )}
      {selected === null && (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#101127",
          }}
        >
          {tabs.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              accessibilityLabel={t.label}
              onPress={() => {
                setTab(t.id);
                setError("");
              }}
              style={{
                flex: 1,
                minHeight: 66,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <Ionicons
                name={t.icon}
                size={23}
                color={tab === t.id ? colors.accent : colors.muted}
              />
              <Text
                style={{
                  fontSize: 10,
                  color: tab === t.id ? colors.accent : colors.muted,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
