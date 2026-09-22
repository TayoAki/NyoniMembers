import {
  BodoniModa_400Regular,
  BodoniModa_400Regular_Italic,
  BodoniModa_500Medium,
  useFonts as useBodoni,
} from "@expo-google-fonts/bodoni-moda";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  useFonts as useManrope,
} from "@expo-google-fonts/manrope";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/components/app/providers";
import { BrandHeader } from "@/components/ui/brand-header";
import { useSession } from "@/lib/session";
import { ny } from "@/lib/theme";

/** The only places a visitor with no session belongs. Everything else is a member's. */
const PUBLIC_SEGMENTS = new Set(["index", "sign-in", "sign-up", "+not-found"]);

function Navigator() {
  const { isSignedIn, isLoading } = useSession();
  const segments = useSegments();

  // Nothing renders while Clerk restores the session from the secure store: a flash of the front
  // door under a member who is in fact signed in is worse than a moment of ink.
  if (isLoading) return <View style={{ flex: 1, backgroundColor: ny.ink }} />;

  // A member's screen reached by typing its URL is still a member's screen. The tabs guard
  // themselves; this catches everything on the root stack.
  if (!isSignedIn && !PUBLIC_SEGMENTS.has(segments[0] ?? "index")) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        header: ({ back }) => <BrandHeader canGoBack={Boolean(back)} />,
        contentStyle: { backgroundColor: ny.ivory },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[productId]" />
      <Stack.Screen name="bag" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="looks/new" />
      <Stack.Screen name="looks/[lookId]" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="atelier" options={{ presentation: "modal" }} />
      <Stack.Screen name="circle/index" />
      <Stack.Screen name="circle/suit" />
      <Stack.Screen name="circle/appointments" />
      <Stack.Screen name="circle/clothier" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

/**
 * Two faces, both the house's own: Bodoni Moda for headings, Manrope for everything else. The
 * splash holds until they are ready, because the wordmark in a fallback serif is worse than a
 * moment more of nothing.
 */
export default function RootLayout() {
  const [bodoni] = useBodoni({ BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium });
  const [manrope] = useManrope({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold });

  if (!bodoni || !manrope) return <View style={{ flex: 1, backgroundColor: ny.ink }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          {/* The header is always ink, so the status bar is always light. */}
          <StatusBar style="light" />
          <Navigator />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
