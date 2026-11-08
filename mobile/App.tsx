import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ApiError, request, Session, storage } from "./src/api";
import { colors, styles as s } from "./src/theme";
import { Button } from "./src/components";
import { SessionContext } from "./src/session-context";
import { PropsWithChildren } from "react";

function Login({
  onLogin,
  notice,
}: {
  onLogin: (session: Session) => void;
  notice: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const session = await request<Session>("/api/mobile/session", undefined, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      try {
        await storage.write(session);
      } catch {
        await request("/api/mobile/session", session.token, {
          method: "DELETE",
        }).catch(() => {});
        throw new Error("Не удалось безопасно сохранить вход на устройстве.");
      }
      setPassword("");
      onLogin(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          s.content,
          { flexGrow: 1, justifyContent: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.title, { fontSize: 36 }]}>
          Episy<Text style={{ color: colors.accent }}>Hub</Text>
        </Text>
        <Text style={s.muted}>Твои фильмы, сериалы и прогресс просмотра</Text>
        <View style={s.panel}>
          <Text style={s.heading}>С возвращением</Text>
          <Text style={s.muted}>Войди в существующий аккаунт EpisyHub</Text>
          {!!notice && (
            <Text accessibilityRole="alert" style={s.muted}>
              {notice}
            </Text>
          )}
          <Text nativeID="email-label" style={s.text}>
            Почта
          </Text>
          <TextInput
            accessibilityLabel="Почта"
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            style={s.input}
            editable={!busy}
          />
          <Text style={s.text}>Пароль</Text>
          <TextInput
            accessibilityLabel="Пароль"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль от сайта"
            placeholderTextColor={colors.muted}
            style={s.input}
            editable={!busy}
            onSubmitEditing={login}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            title="Войти"
            onPress={login}
            busy={busy}
            disabled={!email.trim() || !password}
          />
        </View>
        <Text style={s.muted}>
          Регистрация и подтверждение почты пока доступны на сайте.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export default function AppShell({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [notice, setNotice] = useState("");
  async function restore() {
    setRestoreError("");
    setReady(false);
    try {
      const saved = await storage.read();
      if (saved) {
        if (
          !Number.isFinite(Date.parse(saved.expiresAt)) ||
          Date.parse(saved.expiresAt) <= Date.now()
        ) {
          await storage.write(null);
          setNotice("Срок входа истёк. Войди ещё раз.");
        } else {
          try {
            const state = await request<Omit<Session, "token">>(
              "/api/mobile/session",
              saved.token,
            );
            setSession({ ...saved, ...state });
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
              await storage.write(null);
              setNotice("Войди в аккаунт ещё раз.");
            } else throw e;
          }
        }
      }
      setReady(true);
    } catch (e) {
      setRestoreError(
        e instanceof Error ? e.message : "Не удалось восстановить вход",
      );
    }
  }
  useEffect(() => {
    void restore();
  }, []);
  const clearSession = useCallback(async (message = "") => {
    await storage.write(null);
    setSession(null);
    setNotice(message);
  }, []);
  const expireSession = useCallback(
    () => clearSession("Сессия завершена. Войди ещё раз."),
    [clearSession],
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {!ready ? (
          <View style={[s.content, s.flex, { justifyContent: "center" }]}>
            {restoreError ? (
              <>
                <Text accessibilityRole="alert" style={s.error}>
                  {restoreError}
                </Text>
                <Button title="Повторить" onPress={restore} />
              </>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
          </View>
        ) : session ? (
          <SessionContext.Provider
            key={session.token}
            value={{
              session,
              onLogout: clearSession,
              onExpired: expireSession,
            }}
          >
            {children}
          </SessionContext.Provider>
        ) : (
          <Login onLogin={setSession} notice={notice} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
