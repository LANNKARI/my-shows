import { Stack } from "expo-router";
import AppShell from "../../App";
import { colors } from "../theme";
export default function RootLayout() {
  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </AppShell>
  );
}
