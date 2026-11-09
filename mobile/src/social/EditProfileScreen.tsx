import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "../components";
import { colors, styles as s } from "../theme";
import { Feedback, goBack, Loading, Screen } from "./components";
import { useResource, useSocialApi, useTask } from "./hooks";
import { MyProfile } from "./types";
function Form({ user }: { user: MyProfile }) {
  const api = useSocialApi();
  const task = useTask();
  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  return (
    <View style={{ gap: 15 }}>
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
      <Feedback error={task.error} />
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
    </View>
  );
}
export default function EditProfileScreen() {
  const profile = useResource<MyProfile>("/api/users/me");
  return (
    <Screen title="Редактировать профиль" back>
      <Feedback error={profile.error} retry={() => void profile.refresh()} />
      {profile.loading && !profile.data && <Loading />}
      {profile.data && <Form key={profile.data.id} user={profile.data} />}
    </Screen>
  );
}
