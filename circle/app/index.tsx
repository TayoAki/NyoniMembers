import { Link, Redirect, useRouter } from "expo-router";
import { ImageBackground, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Wordmark } from "@/components/ui/wordmark";
import { pieceImage } from "@/lib/images";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { useColours } from "@/lib/use-theme";

/**
 * The front door. The only screen a signed-out visitor sees, and the only place the house explains
 * what the Circle is before asking anyone to sign in.
 */
export default function FrontDoor() {
  const { isSignedIn } = useSession();
  const colours = useColours();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: colours.background }}>
      <ImageBackground
        source={pieceImage("nyoni-isabella-bleu-pin-suit")}
        resizeMode="cover"
        imageStyle={{ opacity: 0.5 }}
        style={{ flex: 1, justifyContent: "space-between", paddingTop: insets.top + space.xl }}
      >
        <View style={{ alignItems: "center" }}>
          <Wordmark />
        </View>

        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingBottom: insets.bottom + space.xl,
            gap: space.lg,
            backgroundColor: colours.background + "F2",
            paddingTop: space.xxl,
          }}
        >
          <Text variant="eyebrow" tone="primary">
            The Nyoni Circle
          </Text>
          <Text variant="display">Style, on your terms.</Text>
          <Text variant="body" tone="muted">
            The private members app of Nyoni Couture. Shop the drops, see a piece on yourself, build looks from the
            wardrobe you already own, and keep your clothier one message away.
          </Text>
          <View style={{ gap: space.md, paddingTop: space.sm }}>
            <Button label="Sign in" size="lg" onPress={() => router.push("/sign-in")} />
            <Button
              label="Apply for membership"
              variant="secondary"
              size="lg"
              onPress={() => router.push("/sign-up")}
            />
          </View>
          <Link href="/sign-up" style={{ paddingTop: space.xs }}>
            <Text variant="bodySmall" tone="muted" center>
              Charlotte · Atlanta · Houston
            </Text>
          </Link>
        </View>
      </ImageBackground>
    </View>
  );
}
