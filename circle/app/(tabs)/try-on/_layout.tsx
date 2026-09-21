import { Stack } from "expo-router";
import { BrandHeader } from "@/components/ui/brand-header";
import { ny } from "@/lib/theme";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        header: ({ back }) => <BrandHeader canGoBack={Boolean(back)} />,
        contentStyle: { backgroundColor: ny.ivory },
      }}
    />
  );
}
