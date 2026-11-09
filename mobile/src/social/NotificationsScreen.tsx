import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../components";
import { colors, styles as s } from "../theme";
import { Feedback, Loading, PersonRow, Screen } from "./components";
import { deviceZone, useResource, useSocialApi, useTask } from "./hooks";
import { FriendNotice, Inbox, Preferences, ReleaseNotice } from "./types";
export default function NotificationsScreen() {
  const api = useSocialApi();
  const task = useTask();
  const [mode, setMode] = useState<"all" | "unread">("all");
  const zone = encodeURIComponent(deviceZone());
  const inbox = useResource<Inbox>(
    `/api/notifications?mode=${mode}&timeZone=${zone}`,
  );
  const data = inbox.data;
  async function readOne(item: ReleaseNotice) {
    inbox.invalidate();
    const ok = await task.run(`read-${item.id}`, async () => {
      await api(`/api/notifications?timeZone=${zone}`, {
        method: "PATCH",
        body: JSON.stringify({ ids: [item.id] }),
      });
      inbox.update((current) => ({
        ...current,
        unreadCount: Math.max(
          0,
          current.unreadCount -
            (current.items.some((value) => value.id === item.id && !value.read)
              ? 1
              : 0),
        ),
        items: current.items.map((value) =>
          value.id === item.id ? { ...value, read: true } : value,
        ),
      }));
      return "Уведомление прочитано";
    });
    if (!ok) void inbox.refresh();
  }
  async function readAll() {
    if (!data) return;
    inbox.invalidate();
    await task.run("read-all", async () => {
      await api(`/api/notifications?timeZone=${zone}`, {
        method: "PATCH",
        body: JSON.stringify({
          all: true,
          throughId: data.latestId,
          throughFriendId: data.latestFriendId,
        }),
      });
      inbox.update((current) => {
        const items = current.items.map((item) =>
          item.id <= data.latestId ? { ...item, read: true } : item,
        );
        const friendRequests = current.friendRequests.map((item) =>
          item.id <= data.latestFriendId ? { ...item, read: true } : item,
        );
        const visibleNewUnread =
          items.filter((item) => !item.read).length +
          friendRequests.filter((item) => !item.read).length;
        return {
          ...current,
          items,
          friendRequests,
          unreadCount: Math.max(
            visibleNewUnread,
            current.unreadCount - data.unreadCount,
            0,
          ),
        };
      });
      return "Уведомления прочитаны";
    });
    // Refresh the global count too: another device may have changed unread state.
    void inbox.refresh();
  }
  async function handleFriend(
    item: FriendNotice,
    action: "accept" | "decline",
  ) {
    inbox.invalidate();
    const ok = await task.run(`friend-${item.id}`, async () => {
      await api(`/api/notifications/friends/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      inbox.update((current) => ({
        ...current,
        friendRequests: current.friendRequests.filter(
          (value) => value.id !== item.id,
        ),
        unreadCount: Math.max(
          0,
          current.unreadCount -
            (current.friendRequests.some(
              (value) => value.id === item.id && !value.read,
            )
              ? 1
              : 0),
        ),
      }));
      return action === "accept" ? "Заявка принята" : "Заявка отклонена";
    });
    if (!ok) void inbox.refresh();
  }
  async function preference(
    key: "releaseNotificationsEnabled" | "notifyNewShows",
    value: boolean,
  ) {
    inbox.invalidate();
    await task.run(`preference-${key}`, async () => {
      const preferences = await api<Preferences>("/api/release-preferences", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value, timeZone: deviceZone() }),
      });
      inbox.update((current) => ({ ...current, preferences }));
      return "Настройки сохранены";
    });
  }
  async function more() {
    if (!data?.nextCursor) return;
    const snapshot = data;
    await task.run("more", async () => {
      const next = await api<Inbox>(
        `/api/notifications?mode=${mode}&cursor=${snapshot.nextCursor}&timeZone=${zone}`,
      );
      inbox.update((current) => {
        if (current !== snapshot) return current;
        const ids = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [
            ...current.items,
            ...next.items.filter((item) => !ids.has(item.id)),
          ],
          nextCursor: next.nextCursor,
        };
      });
    });
  }
  const releases =
    data?.items.filter((item) => mode === "all" || !item.read) || [];
  const requests =
    data?.friendRequests.filter((item) => mode === "all" || !item.read) || [];
  return (
    <Screen
      title="Уведомления"
      back
      loading={inbox.loading}
      refresh={() => void inbox.refresh()}
    >
      <View style={s.row}>
        {[
          { value: "all", label: "Все" },
          {
            value: "unread",
            label: `Непрочитанные${data ? ` · ${data.unreadCount}` : ""}`,
          },
        ].map((tab) => (
          <Pressable
            key={tab.value}
            accessibilityRole="button"
            accessibilityLabel={
              tab.value === "unread" ? "Непрочитанные уведомления" : tab.label
            }
            accessibilityState={{ selected: mode === tab.value }}
            onPress={() => setMode(tab.value as typeof mode)}
            style={[s.button, mode !== tab.value && s.outline, { flex: 1 }]}
          >
            <Text
              style={[
                s.buttonText,
                mode !== tab.value && { color: colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Feedback
        error={inbox.error || task.error}
        notice={task.notice}
        retry={() => void inbox.refresh()}
      />
      {inbox.loading && !data && <Loading />}
      {data && (
        <>
          <Button
            title="Прочитать всё"
            secondary
            busy={task.busy === "read-all"}
            disabled={task.busy !== null || !data.unreadCount}
            onPress={() => void readAll()}
          />
          {requests.map((item) => (
            <View
              key={`friend-${item.id}`}
              style={[
                s.panel,
                !item.read && {
                  borderLeftColor: colors.accent,
                  borderLeftWidth: 3,
                },
              ]}
            >
              <Text style={{ color: colors.accent, fontSize: 11 }}>
                ЗАЯВКА В ДРУЗЬЯ
              </Text>
              <PersonRow person={item.user} />
              <View style={s.row}>
                <View style={s.flex}>
                  <Button
                    title="Принять заявку"
                    busy={task.busy === `friend-${item.id}`}
                    disabled={task.busy !== null}
                    onPress={() => void handleFriend(item, "accept")}
                  />
                </View>
                <View style={s.flex}>
                  <Button
                    title="Отклонить заявку"
                    secondary
                    disabled={task.busy !== null}
                    onPress={() => void handleFriend(item, "decline")}
                  />
                </View>
              </View>
            </View>
          ))}
          {releases.map((item) => (
            <View
              key={`release-${item.id}`}
              style={[
                s.panel,
                !item.read && {
                  borderLeftColor: colors.accent,
                  borderLeftWidth: 3,
                },
              ]}
            >
              <Text style={{ color: colors.accent, fontSize: 11 }}>
                НОВАЯ СЕРИЯ
              </Text>
              <Text style={s.heading}>{item.title}</Text>
              <Text style={s.muted}>
                Сезон {item.season} · серия {item.episode} ·{" "}
                {new Date(item.date + "T12:00:00").toLocaleDateString("ru-RU")}
              </Text>
              {item.read ? (
                <Text style={s.badge}>Прочитано</Text>
              ) : (
                <Button
                  title={`Прочитано: ${item.title}, серия ${item.episode}`}
                  secondary
                  busy={task.busy === `read-${item.id}`}
                  disabled={task.busy !== null}
                  onPress={() => void readOne(item)}
                />
              )}
            </View>
          ))}
          {!requests.length && !releases.length && (
            <Text style={s.muted}>
              {mode === "unread"
                ? "Непрочитанных уведомлений нет."
                : "Пока нет уведомлений."}
            </Text>
          )}
          {!!data.friendRequestsTruncated && (
            <Button
              title="Все заявки в друзья"
              secondary
              onPress={() => router.push("/friends")}
            />
          )}
          {data.nextCursor !== null && (
            <Button
              title="Показать ещё уведомления"
              secondary
              busy={task.busy === "more"}
              disabled={task.busy !== null || inbox.loading}
              onPress={() => void more()}
            />
          )}
          <Text style={s.heading}>Настройки ленты</Text>
          <Text style={s.muted}>Эти настройки общие с сайтом EpisyHub.</Text>
          <View style={s.between}>
            <View style={s.flex}>
              <Text style={s.text}>Уведомления о новых сериях</Text>
              <Text style={s.muted}>Показывать события в ленте</Text>
            </View>
            <Switch
              accessibilityLabel="Уведомления о новых сериях"
              value={data.preferences.releaseNotificationsEnabled}
              disabled={task.busy !== null}
              onValueChange={(value) =>
                void preference("releaseNotificationsEnabled", value)
              }
              trackColor={{ false: colors.border, true: "#5c458a" }}
              thumbColor={colors.accent}
            />
          </View>
          <View style={s.between}>
            <View style={s.flex}>
              <Text style={s.text}>Подписывать новые сериалы</Text>
              <Text style={s.muted}>Когда добавляешь сериал в библиотеку</Text>
            </View>
            <Switch
              accessibilityLabel="Подписывать новые сериалы"
              value={data.preferences.notifyNewShows}
              disabled={task.busy !== null}
              onValueChange={(value) =>
                void preference("notifyNewShows", value)
              }
              trackColor={{ false: colors.border, true: "#5c458a" }}
              thumbColor={colors.accent}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
