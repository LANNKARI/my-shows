import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "./theme";
export type Tab = "home" | "search" | "library" | "calendar" | "profile";
export const tabs: {
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
export function BottomNavigation({ active }: { active: Tab }) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: "#101127",
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab.id }}
          accessibilityLabel={tab.label}
          onPress={() => router.replace(tab.id === "home" ? "/" : `/${tab.id}`)}
          style={{
            flex: 1,
            minHeight: 66,
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <Ionicons
            name={tab.icon}
            size={23}
            color={active === tab.id ? colors.accent : colors.muted}
          />
          <Text
            style={{
              fontSize: 10,
              color: active === tab.id ? colors.accent : colors.muted,
            }}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
