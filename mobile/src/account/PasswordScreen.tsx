import { useState } from "react";
import { Text, TextInput } from "react-native";
import { Button } from "../components";
import { Feedback, Screen } from "../social/components";
import { useSocialApi, useTask } from "../social/hooks";
import { useSessionActions } from "../session-context";
import { styles as s } from "../theme";
export default function PasswordScreen() {
  const api = useSocialApi(),
    task = useTask();
  const { onExpired } = useSessionActions();
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState("");
  const [changed, setChanged] = useState(false);
  return (
    <Screen title="Изменить пароль" back>
      <Text style={s.muted}>
        После смены пароля нужно войти в аккаунт заново на всех устройствах.
      </Text>
      {!changed && (
        <>
          {[
            ["Текущий пароль", current, setCurrent],
            ["Новый пароль", next, setNext],
            ["Повторите новый пароль", confirm, setConfirm],
          ].map(([label, value, change]) => (
            <TextInput
              key={String(label)}
              accessibilityLabel={String(label)}
              placeholder={String(label)}
              placeholderTextColor="#aaa7c6"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={
                label === "Текущий пароль" ? "current-password" : "new-password"
              }
              value={value as string}
              onChangeText={change as (text: string) => void}
              style={s.input}
              editable={!task.busy}
            />
          ))}
          <Text style={s.muted}>От 8 символов, не более 72 байт UTF-8.</Text>
          <Feedback error={task.error} />
          <Button
            title="Изменить пароль"
            busy={!!task.busy}
            disabled={!current || !next || !confirm}
            onPress={() =>
              void task.run("password", async () => {
                if (next !== confirm) throw Error("Новые пароли не совпадают.");
                if (next.length < 8)
                  throw Error("Новый пароль должен содержать от 8 символов.");
                await api("/api/users/me/password", {
                  method: "POST",
                  body: JSON.stringify({
                    currentPassword: current,
                    newPassword: next,
                  }),
                });
                setChanged(true);
                setCurrent("");
                setNext("");
                setConfirm("");
                await onExpired();
              })
            }
          />
        </>
      )}
      {changed && (
        <>
          <Text style={s.badge}>
            Пароль изменён. Завершите выход для повторного входа.
          </Text>
          <Feedback error={task.error} />
          <Button
            title="Перейти ко входу"
            onPress={() => void task.run("clear", onExpired)}
          />
        </>
      )}
    </Screen>
  );
}
