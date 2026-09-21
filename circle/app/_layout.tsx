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
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/ui/brand-header";
import { SessionProvider } from "@/lib/session";
import { ny } from "@/lib/theme";

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
        <SessionProvider>
          {/* The header is always ink, so the status bar is always light. */}
          <StatusBar style="light" />
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
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
