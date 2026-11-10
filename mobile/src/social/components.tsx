import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { PropsWithChildren } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles as s } from "../theme";
import { Button } from "../components";
import { BottomNavigation } from "../navigation";
import { imageUrl } from "../api";
import { Person } from "./types";
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/profile");
}
export function openPerson(user: Person) {
  router.push({
    pathname: "/person/[username]",
    params: { username: user.username },
  });
}
export function Avatar({
  person,
  large = false,
}: {
  person: Person;
  large?: boolean;
}) {
  const uri = imageUrl(person.avatarUrl);
  const [failed, setFailed] = useState<string>();
  const size = large ? 66 : 44;
  return uri && failed !== uri ? (
    <Image
      accessibilityLabel={`Аватар: ${person.name || person.username}`}
      source={{ uri }}
      onError={() => setFailed(uri)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#30264c",
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#30264c",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: large ? 26 : 18,
          fontWeight: "700",
        }}
      >
        {(person.name || person.username).slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
export function PersonRow({
  person,
  children,
}: {
  person: Person;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: 12,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Открыть профиль: ${person.name || person.username}`}
        onPress={() => openPerson(person)}
        style={s.row}
      >
        <Avatar person={person} />
        <View style={s.flex}>
          <Text style={s.heading}>{person.name || person.username}</Text>
          <Text style={s.muted}>@{person.username}</Text>
        </View>
        <Ionicons name="chevron-forward" color={colors.muted} size={18} />
      </Pressable>
      {children}
    </View>
  );
}
export function Feedback({
  error,
  notice,
  retry,
}: {
  error?: string;
  notice?: string;
  retry?: () => void;
}) {
  return (
    <>
      {!!error && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          {retry && (
            <Button title="Повторить загрузку" secondary onPress={retry} />
          )}
        </View>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.badge}>
          {notice}
        </Text>
      )}
    </>
  );
}
export function Screen({
  title,
  back = false,
  refresh,
  loading = false,
  children,
  header,
}: {
  title: string;
  back?: boolean;
  refresh?: () => void;
  loading?: boolean;
  header?: React.ReactNode;
} & PropsWithChildren) {
  return (
    <View style={s.flex}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
      >
        {back && <Button title="Назад" secondary onPress={goBack} />}
        <View style={s.between}>
          <Text style={[s.title, s.flex]}>{title}</Text>
          {header}
        </View>
        {children}
      </ScrollView>
      <BottomNavigation active="profile" />
    </View>
  );
}
export function Loading() {
  return <ActivityIndicator color={colors.accent} />;
}
export function ActionRow({
  title,
  count,
  onPress,
  disabled = false,
}: {
  title: string;
  count?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[s.between, s.divider, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.text}>{title}</Text>
      <View style={s.row}>
        {count !== undefined && (
          <Text style={{ color: colors.accent }}>{count}</Text>
        )}
        <Ionicons name="chevron-forward" color={colors.muted} size={18} />
      </View>
    </Pressable>
  );
}
