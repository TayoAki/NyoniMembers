import { Stack } from "expo-router";
import { BrandHeader } from "@/components/ui/brand-header";
import { ny } from "@/lib/theme";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ back }) => <BrandHeader canGoBack={Boolean(back)} />,
        contentStyle: { backgroundColor: ny.ivory },
        gestureEnabled: false,
      }}
    />
  );
}
