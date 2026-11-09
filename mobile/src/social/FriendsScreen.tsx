import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "../components";
import { colors, styles as s } from "../theme";
import { Feedback, Loading, PersonRow, Screen } from "./components";
import { useDebounced, useResource, useSocialApi, useTask } from "./hooks";
import { FriendRequest, FriendsData, SearchPerson } from "./types";
export default function FriendsScreen() {
  const api = useSocialApi();
  const task = useTask();
  const friends = useResource<FriendsData>("/api/friendships");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [section, setSection] = useState<"friends" | "requests">("friends");
  const search = useResource<SearchPerson[]>(
    debounced.length >= 2
      ? `/api/users/search?q=${encodeURIComponent(debounced)}`
      : null,
  );
  async function send(person: SearchPerson) {
    search.invalidate();
    friends.invalidate();
    const ok = await task.run(`user-${person.id}`, async () => {
      if (person.friendshipStatus === "pending_sent")
        await api(`/api/friendships?userId=${encodeURIComponent(person.id)}`, {
          method: "DELETE",
        });
      else
        await api("/api/friendships", {
          method: "POST",
          body: JSON.stringify({
            targetUserId: person.id,
            action:
              person.friendshipStatus === "pending_received"
                ? "accept"
                : "request",
          }),
        });
      search.update((current) =>
        current.map((user) =>
          user.id === person.id
            ? {
                ...user,
                friendshipStatus:
                  person.friendshipStatus === "pending_sent"
                    ? "none"
                    : person.friendshipStatus === "pending_received"
                      ? "friends"
                      : "pending_sent",
              }
            : user,
        ),
      );
      return person.friendshipStatus === "pending_sent"
        ? "Заявка отменена"
        : person.friendshipStatus === "pending_received"
          ? "Заявка принята"
          : "Заявка отправлена";
    });
    void friends.refresh();
    if (!ok) void search.refresh();
  }
  async function incoming(item: FriendRequest, action: "accept" | "decline") {
    friends.invalidate();
    const ok = await task.run(`request-${item.friendshipId}`, async () => {
      await api(`/api/notifications/friends/${item.friendshipId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      friends.update((current) => ({
        ...current,
        incomingRequests: current.incomingRequests.filter(
          (request) => request.friendshipId !== item.friendshipId,
        ),
        friends:
          action === "accept"
            ? [
                item.user,
                ...current.friends.filter((user) => user.id !== item.user.id),
              ]
            : current.friends,
      }));
      return action === "accept" ? "Заявка принята" : "Заявка отклонена";
    });
    if (!ok) void friends.refresh();
  }
  async function cancel(item: FriendRequest) {
    friends.invalidate();
    await task.run(`outgoing-${item.friendshipId}`, async () => {
      await api(`/api/friendships?userId=${encodeURIComponent(item.user.id)}`, {
        method: "DELETE",
      });
      friends.update((current) => ({
        ...current,
        outgoingRequests: current.outgoingRequests.filter(
          (request) => request.friendshipId !== item.friendshipId,
        ),
      }));
      return "Заявка отменена";
    });
  }
  const searching = query.trim().length > 0;
  const data = friends.data;
  const total =
    (data?.incomingRequests.length || 0) + (data?.outgoingRequests.length || 0);
  return (
    <Screen
      title="Друзья"
      back
      loading={friends.loading}
      refresh={() => {
        void friends.refresh();
        void search.refresh();
      }}
    >
      <Text style={s.muted}>Смотри и делись впечатлениями</Text>
      <TextInput
        accessibilityLabel="Поиск друзей"
        value={query}
        onChangeText={setQuery}
        placeholder="Имя или @ник"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={s.input}
      />
      <Feedback
        error={task.error || friends.error || search.error}
        notice={task.notice}
        retry={() => {
          void friends.refresh();
          void search.refresh();
        }}
      />
      {searching ? (
        <>
          {query.trim().length < 2 ? (
            <Text style={s.muted}>Введи хотя бы два символа.</Text>
          ) : search.loading || debounced !== query.trim() ? (
            <Loading />
          ) : search.data?.length ? (
            search.data.map((person) => (
              <PersonRow key={person.id} person={person}>
                {person.friendshipStatus === "friends" ? (
                  <Text style={s.badge}>У вас в друзьях</Text>
                ) : (
                  <Button
                    title={
                      person.friendshipStatus === "pending_sent"
                        ? "Отменить заявку"
                        : person.friendshipStatus === "pending_received"
                          ? "Принять заявку"
                          : "Добавить в друзья"
                    }
                    secondary={person.friendshipStatus === "pending_sent"}
                    busy={task.busy === `user-${person.id}`}
                    disabled={task.busy !== null}
                    onPress={() => void send(person)}
                  />
                )}
              </PersonRow>
            ))
          ) : (
            !search.error && (
              <Text style={s.muted}>Пользователи не найдены.</Text>
            )
          )}
        </>
      ) : (
        <>
          <View style={s.row}>
            {[
              { value: "friends", label: "Мои друзья" },
              { value: "requests", label: `Заявки · ${total}` },
            ].map((tab) => (
              <Pressable
                key={tab.value}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: section === tab.value }}
                onPress={() => setSection(tab.value as typeof section)}
                style={[
                  s.button,
                  section !== tab.value && s.outline,
                  { flex: 1 },
                ]}
              >
                <Text
                  style={[
                    s.buttonText,
                    section !== tab.value && { color: colors.muted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {friends.loading && !data && <Loading />}
          {data &&
            (section === "friends" ? (
              <>
                {!data.friends.length && (
                  <Text style={s.muted}>
                    Пока нет друзей. Найди знакомых по имени или нику.
                  </Text>
                )}
                {data.friends.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </>
            ) : (
              <>
                <Text style={s.heading}>Входящие</Text>
                {!data.incomingRequests.length && (
                  <Text style={s.muted}>Новых заявок нет.</Text>
                )}
                {data.incomingRequests.map((item) => (
                  <PersonRow key={item.friendshipId} person={item.user}>
                    <View style={s.row}>
                      <View style={s.flex}>
                        <Button
                          title="Принять заявку"
                          busy={task.busy === `request-${item.friendshipId}`}
                          disabled={task.busy !== null}
                          onPress={() => void incoming(item, "accept")}
                        />
                      </View>
                      <View style={s.flex}>
                        <Button
                          title="Отклонить заявку"
                          secondary
                          disabled={task.busy !== null}
                          onPress={() => void incoming(item, "decline")}
                        />
                      </View>
                    </View>
                  </PersonRow>
                ))}
                <Text style={s.heading}>Исходящие</Text>
                {!data.outgoingRequests.length && (
                  <Text style={s.muted}>Отправленных заявок нет.</Text>
                )}
                {data.outgoingRequests.map((item) => (
                  <PersonRow key={item.friendshipId} person={item.user}>
                    <Button
                      title="Отменить заявку"
                      secondary
                      busy={task.busy === `outgoing-${item.friendshipId}`}
                      disabled={task.busy !== null}
                      onPress={() => void cancel(item)}
                    />
                  </PersonRow>
                ))}
              </>
            ))}
        </>
      )}
    </Screen>
  );
}
