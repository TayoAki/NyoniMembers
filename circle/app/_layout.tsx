import {
  BodoniModa_400Regular,
  BodoniModa_400Regular_Italic,
  BodoniModa_500Medium,
  useFonts as useBodoni,
} from "@expo-google-fonts/bodoni-moda";
import { IBMPlexMono_400Regular, useFonts as useMono } from "@expo-google-fonts/ibm-plex-mono";
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
import { SessionProvider } from "@/lib/session";
import { palettes } from "@/lib/theme";
import { ThemeProvider, useTheme } from "@/lib/use-theme";

export default function RootLayout() {
  const [bodoni] = useBodoni({ BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium });
  const [manrope] = useManrope({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold });
  const [mono] = useMono({ IBMPlexMono_400Regular });
  const fontsReady = bodoni && manrope && mono;

  // The splash stays until Bodoni is available: the house wordmark in a fallback serif is worse
  // than one more moment of the splash screen.
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: palettes.dark.background }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <Chrome />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Chrome() {
  const { scheme, colours } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
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
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
        <Stack.Screen name="sign-up" options={{ title: "Apply to the Circle" }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[productId]" options={{ title: "" }} />
        <Stack.Screen name="bag" options={{ title: "Your bag" }} />
        <Stack.Screen name="orders" options={{ title: "Orders" }} />
        <Stack.Screen name="looks/new" options={{ title: "Build a look" }} />
        <Stack.Screen name="looks/[lookId]" options={{ title: "" }} />
        <Stack.Screen name="calendar" options={{ title: "Your calendar" }} />
        <Stack.Screen name="atelier" options={{ title: "Atelier", presentation: "modal" }} />
        <Stack.Screen name="circle/index" options={{ title: "The Circle" }} />
        <Stack.Screen name="circle/suit" options={{ title: "Your annual suit" }} />
        <Stack.Screen name="circle/appointments" options={{ title: "Appointments" }} />
        <Stack.Screen name="circle/clothier" options={{ title: "Your clothier" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}
