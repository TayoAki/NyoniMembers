import { Stack } from "expo-router";
import { useColours } from "@/lib/use-theme";

export default function TryOnLayout() {
  const colours = useColours();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colours.background },
        headerTintColor: colours.foreground,
        headerTitleStyle: { fontFamily: "Manrope_600SemiBold", fontSize: 16 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colours.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[previewId]" options={{ title: "" }} />
    </Stack>
  );
}
