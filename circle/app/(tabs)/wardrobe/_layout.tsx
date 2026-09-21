import { Stack } from "expo-router";
import { useColours } from "@/lib/use-theme";

export default function WardrobeLayout() {
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
      <Stack.Screen name="[pieceId]" options={{ title: "" }} />
      <Stack.Screen name="add" options={{ title: "Add a piece" }} />
      <Stack.Screen name="analytics" options={{ title: "Your wardrobe" }} />
    </Stack>
  );
}
