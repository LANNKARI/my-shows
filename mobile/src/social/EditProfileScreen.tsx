import { useDataCache } from "../data-context";
import { router } from "expo-router";
import { useState, useSyncExternalStore } from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "../components";
import { colors, styles as s } from "../theme";
import { pickAvatar, saveBackup } from "../account/device-files";
import {
  Avatar,
  ActionRow,
  Feedback,
  goBack,
  Loading,
  Screen,
} from "./components";
import { useResource, useSocialApi, useTask } from "./hooks";
import { MyProfile } from "./types";
function Form({ user }: { user: MyProfile }) {
  const api = useSocialApi();
  const cache = useDataCache();
  useSyncExternalStore(cache.subscribe, cache.getVersion);
  const task = useTask();
  const [name, setName] = useState(user.name || "");
  const [avatar, setAvatar] = useState(user.avatarUrl);
  const [bio, setBio] = useState(user.bio || "");
  return (
    <View style={{ gap: 15 }}>
      <View style={[s.row, { justifyContent: "center" }]}>
        <Avatar person={{ ...user, avatarUrl: avatar }} large />
        <Button
          title="Изменить аватар"
          secondary
          disabled={!!task.busy}
          busy={task.busy === "avatar"}
          onPress={() =>
            void task.run("avatar", async () => {
              const form = await pickAvatar();
              if (!form) return;
              const upload = await api<{ url: string }>("/api/upload", {
                method: "POST",
                body: form,
              });
              await api("/api/users/me", {
                method: "PATCH",
                body: JSON.stringify({ avatarUrl: upload.url }),
              });
              setAvatar(upload.url);
              return "Аватар обновлён";
            })
          }
        />
      </View>
      <Text style={s.text}>Имя</Text>
      <TextInput
        accessibilityLabel="Имя профиля"
        value={name}
        onChangeText={setName}
        maxLength={80}
        style={s.input}
        editable={!task.busy}
        placeholder="Как тебя зовут"
        placeholderTextColor={colors.muted}
      />
      <Text style={s.text}>О себе</Text>
      <TextInput
        accessibilityLabel="Описание профиля"
        value={bio}
        onChangeText={setBio}
        maxLength={300}
        multiline
        textAlignVertical="top"
        style={[s.input, { minHeight: 120 }]}
        editable={!task.busy}
        placeholder="Твои любимые истории и интересы"
        placeholderTextColor={colors.muted}
      />
      <Text style={s.muted}>{bio.length} / 300</Text>
      <Feedback error={task.error} notice={task.notice} />
      <Button
        title="Сохранить профиль"
        busy={task.busy === "save"}
        onPress={() =>
          void task.run("save", async () => {
            await api("/api/users/me", {
              method: "PATCH",
              body: JSON.stringify({ name: name.trim(), bio: bio.trim() }),
            });
            goBack();
          })
        }
      />
      <Text style={s.heading}>Библиотека</Text>
      {cache.libraryWrite.busy && (
        <Text style={s.muted}>
          Дождитесь сохранения отметок перед экспортом, импортом или сменой
          пароля.
        </Text>
      )}
      <ActionRow
        title="Импорт библиотеки"
        disabled={!!task.busy || cache.libraryWrite.busy}
        onPress={() => router.push("/profile/import")}
      />
      <ActionRow
        title="Экспорт библиотеки"
        disabled={!!task.busy || cache.libraryWrite.busy}
        onPress={() =>
          void task.run("export", async () => {
            const backup = await api<{
              meta: unknown;
              userShows: unknown[];
              collections: unknown[];
            }>("/api/export");
            await saveBackup({
              meta: backup.meta,
              userShows: backup.userShows,
              collections: backup.collections,
            });
            return "Файл библиотеки подготовлен";
          })
        }
      />
      {task.busy === "export" && (
        <Text style={s.muted}>Подготавливаем файл…</Text>
      )}
      <Text style={s.heading}>Безопасность</Text>
      <ActionRow
        title="Изменить пароль"
        disabled={!!task.busy || cache.libraryWrite.busy}
        onPress={() => router.push("/profile/password")}
      />
    </View>
  );
}
export default function EditProfileScreen() {
  const profile = useResource<MyProfile>("/api/users/me");
  return (
    <Screen title="Настройки профиля" back>
      <Feedback error={profile.error} retry={() => void profile.refresh()} />
      {profile.loading && !profile.data && <Loading />}
      {profile.data && <Form key={profile.data.id} user={profile.data} />}
    </Screen>
  );
}
