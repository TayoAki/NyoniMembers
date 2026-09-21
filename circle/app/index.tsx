import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Wordmark } from "@/components/ui/wordmark";
import { pieceImage } from "@/lib/images";
import { useSession } from "@/lib/session";
import { ny, space } from "@/lib/theme";
import { SurfaceProvider, useGutter } from "@/lib/use-theme";

/** The front door, and the only screen a signed-out visitor sees. */
export default function FrontDoor() {
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const router = useRouter();

  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <SurfaceProvider tone="dark">
      <View style={{ flex: 1, backgroundColor: ny.ink }}>
        <Image
          source={pieceImage("nyoni-isabella-bleu-pin-suit")}
          contentFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }}
          accessibilityIgnoresInvertColors
          alt="A member in Nyoni tailoring"
        />
        <LinearGradient
          colors={["rgba(12,12,11,0.4)", "rgba(12,12,11,0.85)", ny.ink]}
          locations={[0, 0.5, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />

        <View style={{ flex: 1, justifyContent: "space-between", paddingTop: insets.top + space.x8 }}>
          <View style={{ alignItems: "center" }}>
            <Wordmark size="large" />
          </View>

          <View
            style={{
              paddingHorizontal: gutter,
              paddingBottom: insets.bottom + space.x8,
              gap: space.x4,
            }}
          >
            <Text variant="eyebrow" tone="accent">
              The Nyoni Circle
            </Text>
            <Text variant="hero" accessibilityRole="header">
              {"Style, on\nyour terms."}
            </Text>
            <Text variant="body" tone="muted">
              The private members app of Nyoni Couture. Shop the drops, see a piece on yourself, and keep your clothier
              one conversation away.
            </Text>
            <View style={{ gap: space.x3, paddingTop: space.x2 }}>
              <Button label="Sign in" variant="ivory" onPress={() => router.push("/sign-in")} />
              <Button label="Apply for membership" variant="secondary" onPress={() => router.push("/sign-up")} />
            </View>
            <Text variant="caption" tone="muted" center>
              Charlotte · Atlanta · Houston
            </Text>
          </View>
        </View>
      </View>
    </SurfaceProvider>
  );
}
