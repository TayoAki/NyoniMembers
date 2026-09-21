import { Stack } from "expo-router";
import { useColours } from "@/lib/use-theme";

export default function OnboardingLayout() {
  const colours = useColours();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colours.background },
        gestureEnabled: false,
      }}
    />
  );
}
