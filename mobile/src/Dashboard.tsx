import {
  router,
  usePathname,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { ApiError, Session } from "./api";
import { useDataCache, useProgressQueue } from "./data-context";
import EpisodeList from "./tracker/EpisodeList";
import { RatingPicker, useRatings } from "./tracker/RatingPicker";
import { Button, LibraryRow, ProgressBar, Poster } from "./components";
import {
  canMark,
  LibraryItem,
  progress,
  statuses,
  applyProgressPatch,
  previewMark,
  ProgressPatch,
} from "./domain";
import { colors, styles as s } from "./theme";

import { BottomNavigation, tabs, Tab } from "./navigation";
const libraryPath = "/api/user-shows?status=library";
const emptyLibrary: LibraryItem[] = [];
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
  onExpired,
}: {
  session: Session;
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
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace("/library");
  }
  const cache = useDataCache();
  const queue = useProgressQueue();
  useSyncExternalStore(cache.subscribe, cache.getVersion);
  const items = cache.get<LibraryItem[]>(libraryPath) || emptyLibrary;
  const setItems = (change: (items: LibraryItem[]) => LibraryItem[]) =>
    cache.set(
      libraryPath,
      change(cache.get<LibraryItem[]>(libraryPath) || emptyLibrary),
    );
  const [status, setStatus] = useState("watching");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!cache.get(libraryPath));
  const loaded = cache.get(libraryPath) !== null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const needsRefresh = cache.libraryWrite.needsRefresh;
  const lock = cache.libraryWrite;
  const mounted = useRef(true);
  const loadId = useRef(0);
  const [movieUndo, setUndo] = useState<Undo | null>(null);
  const undo = movieUndo || queue.undo;
  const [localNotice, setNotice] = useState("");
  const notice = queue.notice || localNotice;
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const api = useCallback(
    <T,>(path: string, init?: RequestInit) => cache.request<T>(path, init),
    [cache],
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
    async (clearError = true, reconcile = false, force = true) => {
      if (cache.libraryWrite.busy && !reconcile) return;
      const version = ++loadId.current;
      const fresh = !force && cache.fresh(libraryPath);
      setLoading(!fresh);
      if (clearError) {
        setError("");
        queue.error = null;
      }
      try {
        const data = await cache.load<LibraryItem[]>(
          libraryPath,
          force || cache.libraryWrite.needsRefresh,
        );
        if (
          version === loadId.current &&
          cache.get(libraryPath) === data &&
          cache.fresh(libraryPath)
        ) {
          cache.libraryWrite.needsRefresh = false;
          cache.notify();
        }
      } catch (e) {
        if (version === loadId.current) await handleError(e);
      } finally {
        if (mounted.current && version === loadId.current) setLoading(false);
      }
    },
    [cache, handleError, queue],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload(true, false, false);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void reload();
      });
      return () => {
        listener.remove();
      };
    }, [reload]),
  );
  useEffect(() => {
    if (queue.error) void handleError(queue.error);
  }, [queue.error, handleError]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => {
        setUndo(null);
        queue.undo = null;
        cache.notify();
      },
      Math.max(0, undo.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo, queue, cache]);
  const loadCalendar = useCallback(
    async (force = true) => {
      setCalendarLoading(true);
      setCalendarError("");
      const now = new Date();
      const localDay = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      try {
        const path = `/api/calendar?from=${localDay(now)}&to=${localDay(end)}&status=all`;
        const cached = cache.get<CalendarData>(path);
        if (cached && mounted.current) setCalendar(cached);
        const data = await cache.load<CalendarData>(path, force);
        if (mounted.current) setCalendar(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await handleError(e);
        else if (mounted.current) setCalendarError(message(e));
      } finally {
        if (mounted.current) setCalendarLoading(false);
      }
    },
    [cache, handleError],
  );
  useFocusEffect(
    useCallback(() => {
      if (tab !== "calendar" || selected !== null) return;
      void loadCalendar(false);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void loadCalendar();
      });
      return () => listener.remove();
    }, [tab, selected, loadCalendar]),
  );
  async function mutate(item: LibraryItem, action: "mark" | "undo") {
    if (busy || (lock.busy && !queue.saving)) return;
    if (action === "mark" && item.kind !== "movie") {
      const latest =
        cache
          .get<LibraryItem[]>(libraryPath)
          ?.find((value) => value.userShowId === item.userShowId) || item;
      const next = progress(latest).next;
      if (next && !needsRefresh) {
        setError("");
        setUndo(null);
        setNotice("");
        loadId.current++;
        queue.enqueue(latest, next.id, true, true);
      }
      return;
    }
    queue.notice = "";
    queue.undo = null;
    if (lock.busy || (lock.busy && !queue.saving) || needsRefresh) return;
    lock.busy = true;
    setBusy(true);
    setPendingId(item.userShowId);
    setError("");
    setNotice(action === "mark" ? "Сохраняем отметку…" : "Отменяем отметку…");
    const undoToken = undo?.token;
    setUndo(null);
    loadId.current++;
    setLoading(false);
    if (action === "mark")
      setItems((current) =>
        current.map((value) =>
          value.userShowId === item.userShowId ? previewMark(value) : value,
        ),
      );
    try {
      const data = await api<{
        item: ProgressPatch;
        undoToken?: string;
        undoExpiresAt?: number;
        message: string;
      }>(`/api/user-shows/${item.userShowId}/quick-progress`, {
        method: "POST",
        body: JSON.stringify(
          action === "undo"
            ? { action, token: undoToken }
            : {
                action,
                expectedUpdatedAt: item.updatedAt,
                expectedEpisodeId: progress(item).next?.id,
              },
        ),
      });
      // The mutation already returns authoritative progress: no second full-library GET.
      setItems((current) => applyProgressPatch(current, data.item));
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
      setItems((current) =>
        current.map((value) =>
          value.userShowId === item.userShowId ? item : value,
        ),
      );
      cache.libraryWrite.needsRefresh = true;
      cache.invalidate((path) => path === libraryPath);
      if (mounted.current) setNotice("");
      await handleError(e);
      // A lost response may mean the server committed. Reconcile before another mark.
      if (!(e instanceof ApiError && e.status === 401))
        await reload(false, true);
    } finally {
      lock.busy = false;
      cache.notify();
      if (mounted.current) {
        setBusy(false);
        setPendingId(null);
      }
    }
  }
  function toggleEpisode(item: LibraryItem, episodeId: number) {
    if (needsRefresh || busy) return;
    const latest =
      cache
        .get<LibraryItem[]>(libraryPath)
        ?.find((value) => value.userShowId === item.userShowId) || item;
    const watched = !latest.progress.some(
      (p) => p.episodeId === episodeId && p.watched,
    );
    setError("");
    setUndo(null);
    setNotice("");
    loadId.current++;
    queue.enqueue(latest, episodeId, watched);
  }
  const current = items.find((item) => item.userShowId === selected);
  const ratings = useRatings(selected);
  const externalBusy = lock.busy && !queue.saving;
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
          <Text
            accessibilityLiveRegion="polite"
            style={pendingId === null && !lock.busy ? s.badge : s.muted}
          >
            {notice}
          </Text>
          {undoItem && !lock.busy && (
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
        <EpisodeList
          key={selected}
          item={current}
          ratings={ratings.data || []}
          refreshRatings={ratings.refresh}
          header={
            <View style={{ gap: 20 }}>
              <Button title="Назад" secondary onPress={back} />
              {loading && !loaded ? (
                <ActivityIndicator color={colors.accent} />
              ) : current ? (
                <View style={{ gap: 20 }}>
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
                    {(canMark(current) || pendingId === current.userShowId) && (
                      <Button
                        title={
                          current.kind === "movie"
                            ? "Отметить фильм"
                            : "Отметить следующую серию"
                        }
                        busy={current.kind === "movie" && busy}
                        disabled={
                          (!loaded && loading) ||
                          externalBusy ||
                          needsRefresh ||
                          (current.kind === "movie" && lock.busy)
                        }
                        onPress={() => void mutate(current, "mark")}
                      />
                    )}
                  </View>
                  <RatingPicker
                    item={current}
                    ratings={ratings.data || []}
                    refresh={ratings.refresh}
                  />
                  {!!ratings.error && (
                    <Text style={s.error}>{ratings.error}</Text>
                  )}
                </View>
              ) : (
                <Text style={s.muted}>
                  Запись больше не найдена в библиотеке. Обнови список.
                </Text>
              )}
            </View>
          }
          refreshControl={refresh}
          busy={busy || externalBusy || needsRefresh}
          onToggle={(episodeId) => current && toggleEpisode(current, episodeId)}
        />
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
          <View style={s.between}>
            <Text style={[s.heading, { fontSize: 25 }]}>
              Episy<Text style={{ color: colors.accent }}>Hub</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Открыть уведомления"
              onPress={() => router.push("/notifications")}
              style={{
                minHeight: 44,
                minWidth: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={colors.accent}
              />
            </Pressable>
          </View>
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
                <View style={[s.row, { alignItems: "flex-start" }]}>
                  <View
                    style={{
                      width: 106,
                      height: 159,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <Poster
                      url={watching[0].posterUrl}
                      title={watching[0].title}
                      large
                    />
                  </View>
                  <View style={[s.flex, { gap: 10, paddingTop: 6 }]}>
                    <Text style={s.heading}>{watching[0].title}</Text>
                    <Text style={s.muted}>
                      {watching[0].kind === "movie" ? "Фильм" : "Сериал"}
                      {watching[0].year ? ` · ${watching[0].year}` : ""}
                    </Text>
                    <Text style={{ color: colors.accent }}>
                      Открыть трекер ›
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Text style={s.muted}>
                {progress(watching[0]).next
                  ? `Сезон ${progress(watching[0]).next!.season} · серия ${progress(watching[0]).next!.episode}`
                  : "Смотрю"}
              </Text>
              <ProgressBar item={watching[0]} />
              {(canMark(watching[0]) ||
                pendingId === watching[0].userShowId) && (
                <Button
                  title={
                    watching[0].kind === "movie"
                      ? "Отметить фильм"
                      : "Отметить серию"
                  }
                  busy={watching[0].kind === "movie" && busy}
                  disabled={
                    (!loaded && loading) ||
                    externalBusy ||
                    needsRefresh ||
                    (watching[0].kind === "movie" && lock.busy)
                  }
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
      {selected === null && <BottomNavigation active={tab} />}
    </View>
  );
}
