import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Poster } from "../components";
import { styles as s, colors } from "../theme";
import { useSessionActions } from "../session-context";
import { ActionRow, Avatar, Feedback, Loading, Screen } from "./components";
import { useResource, useSocialApi, useTask, deviceZone } from "./hooks";
import { Profile, FriendsData, Inbox } from "./types";

export default function ProfileScreen() {
  const { session, onLogout } = useSessionActions();
  const params = useLocalSearchParams<{ username?: string }>();
  const username = params.username || session.user.username;
  const own = username === session.user.username;
  const api = useSocialApi();
  const task = useTask();
  const profile = useResource<Profile>(
    `/api/users/${encodeURIComponent(username)}`,
  );
  const friends = useResource<FriendsData>(own ? "/api/friendships" : null);
  const inbox = useResource<Inbox>(
    own
      ? `/api/notifications?mode=unread&timeZone=${encodeURIComponent(deviceZone())}`
      : null,
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [allAchievements, setAllAchievements] = useState(false);
  const data = profile.data;
  async function relationship(action: "request" | "accept" | "remove") {
    if (!data) return;
    profile.invalidate();
    await task.run("relationship", async () => {
      if (action === "remove")
        await api(
          `/api/friendships?userId=${encodeURIComponent(data.user.id)}`,
          { method: "DELETE" },
        );
      else
        await api("/api/friendships", {
          method: "POST",
          body: JSON.stringify({ targetUserId: data.user.id, action }),
        });
      profile.update((current) => ({
        ...current,
        friendshipStatus:
          action === "remove"
            ? "none"
            : action === "accept"
              ? "friends"
              : current.friendshipStatus === "pending_received"
                ? "friends"
                : "pending_sent",
      }));
      setConfirmRemove(false);
      void profile.refresh();
      return action === "remove"
        ? "Связь удалена"
        : action === "accept"
          ? "Заявка принята"
          : "Заявка отправлена";
    });
  }
  const achievements =
    data?.achievements.filter((item) => allAchievements || item.unlocked) || [];
  return (
    <Screen
      title={own ? "Профиль" : `@${username}`}
      back={!own}
      loading={profile.loading}
      refresh={() => {
        void profile.refresh();
        void friends.refresh();
        void inbox.refresh();
      }}
      header={
        own ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Открыть уведомления"
            onPress={() => router.push("/notifications")}
            style={[s.row, { minHeight: 44, paddingHorizontal: 8 }]}
          >
            <Ionicons
              name="notifications-outline"
              size={25}
              color={colors.accent}
            />
            {inbox.data && (
              <Text style={{ color: colors.accent }}>
                {inbox.data.unreadCount}
              </Text>
            )}
          </Pressable>
        ) : undefined
      }
    >
      <Feedback
        error={profile.error || task.error}
        notice={task.notice}
        retry={() => void profile.refresh()}
      />
      {profile.loading && !data && <Loading />}
      {data && (
        <>
          <View style={s.row}>
            <Avatar person={data.user} large />
            <View style={s.flex}>
              <Text style={s.heading}>
                {data.user.name || data.user.username}
              </Text>
              <Text style={s.muted}>@{data.user.username}</Text>
              {data.premiumActive && (
                <Text style={s.badge}>EpisyHub Premium</Text>
              )}
            </View>
          </View>
          <Text style={s.text}>{data.user.bio || "Пока без описания"}</Text>
          {data.isOwnProfile ? (
            <Button
              title="Редактировать профиль"
              secondary
              onPress={() => router.push("/profile/edit")}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {data.friendshipStatus === "none" ? (
                <Button
                  title="Добавить в друзья"
                  busy={task.busy === "relationship"}
                  onPress={() => void relationship("request")}
                />
              ) : data.friendshipStatus === "pending_received" ? (
                <Button
                  title="Принять заявку"
                  busy={task.busy === "relationship"}
                  onPress={() => void relationship("accept")}
                />
              ) : data.friendshipStatus === "pending_sent" ? (
                <Button
                  title="Отменить заявку"
                  secondary
                  busy={task.busy === "relationship"}
                  onPress={() => void relationship("remove")}
                />
              ) : (
                <>
                  <Text style={s.badge}>У вас в друзьях</Text>
                  <Button
                    title="Удалить из друзей"
                    secondary
                    onPress={() => setConfirmRemove(true)}
                  />
                  {confirmRemove && (
                    <View style={s.panel}>
                      <Text style={s.text}>
                        Удалить этого пользователя из друзей?
                      </Text>
                      <Button
                        title="Подтвердить удаление"
                        busy={task.busy === "relationship"}
                        onPress={() => void relationship("remove")}
                      />
                      <Button
                        title="Оставить в друзьях"
                        secondary
                        onPress={() => setConfirmRemove(false)}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Фильмов", value: data.stats.moviesCount },
              { label: "Сериалов", value: data.stats.seriesCount },
              { label: "Часов", value: Math.round(data.stats.hoursWatched) },
            ].map((stat) => (
              <View
                key={stat.label}
                style={[
                  s.panel,
                  { flex: 1, padding: 12, alignItems: "center" },
                ]}
              >
                <Text style={s.heading}>{stat.value}</Text>
                <Text style={s.muted}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {data.isOwnProfile && (
            <View>
              <ActionRow
                title="Мои друзья"
                count={friends.data?.friends.length}
                onPress={() => router.push("/friends")}
              />
              <ActionRow
                title="Уведомления"
                count={inbox.data?.unreadCount}
                onPress={() => router.push("/notifications")}
              />
              {!!(friends.error || inbox.error) && (
                <Text style={s.muted}>
                  Счётчики временно недоступны. Разделы можно открыть отдельно.
                </Text>
              )}
            </View>
          )}
          <Text style={s.heading}>Любимые истории</Text>
          {!data.favorites.length ? (
            <Text style={s.muted}>
              Любимые фильмы и сериалы пока не выбраны.
            </Text>
          ) : (
            <View style={{ gap: 14 }}>
              {data.favorites.map((item) => (
                <View key={item.id} style={s.row}>
                  <Poster title={item.title} url={item.posterUrl} />
                  <View style={s.flex}>
                    <Text style={s.text}>{item.title}</Text>
                    <Text style={s.muted}>
                      {item.kind === "movie" ? "Фильм" : "Сериал"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <Text style={s.heading}>Достижения</Text>
          {!achievements.length && (
            <Text style={s.muted}>Здесь появятся полученные достижения.</Text>
          )}
          {achievements.map((achievement) => (
            <View key={achievement.id} style={s.panel}>
              <Text
                style={[
                  s.text,
                  achievement.unlocked && { color: colors.accent },
                ]}
              >
                {achievement.unlocked ? "✦ " : ""}
                {achievement.title}
              </Text>
              <Text style={s.muted}>{achievement.description}</Text>
              {!achievement.unlocked && (
                <Text style={s.muted}>
                  {achievement.progress.current} / {achievement.progress.target}
                </Text>
              )}
            </View>
          ))}
          <Button
            title={
              allAchievements
                ? "Только полученные достижения"
                : "Все достижения"
            }
            secondary
            onPress={() => setAllAchievements((value) => !value)}
          />
        </>
      )}
      {own && (
        <Button
          title="Выйти из аккаунта"
          secondary
          busy={task.busy === "logout"}
          disabled={task.busy !== null}
          onPress={() =>
            void task.run("logout", async () => {
              await api("/api/mobile/session", { method: "DELETE" });
              await onLogout();
            })
          }
        />
      )}
    </Screen>
  );
}
