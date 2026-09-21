import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/cards";
import { Screen, ScreenHeader } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { atelier } from "@/lib/fixtures";
import { pluralize } from "@/lib/format";
import { space } from "@/lib/theme";

/** The fourteen-day Atelier preview starts here, and the app says so plainly rather than in a footnote. */
export default function OnboardingReady() {
  const router = useRouter();

  return (
    <Screen footer={<Button label="Open my wardrobe" size="lg" onPress={() => router.replace("/(tabs)")} />}>
      <ScreenHeader
        eyebrow="Step 3 of 3"
        title="Your wardrobe is dressed"
        description="Twenty-two Nyoni pieces are already in it, so you can build a look before you photograph a thing."
      />

      <View style={{ gap: space.lg }}>
        <Card>
          <Text variant="eyebrow" tone="primary">
            {pluralize(atelier.previewDays, "day")} of Atelier, on the house
          </Text>
          <Text variant="bodySmall" tone="muted">
            Previews on your own photo, your wardrobe analytics, HD images and inspiration boards are all open until
            your preview ends. Nothing is charged, and nothing renews on its own.
          </Text>
        </Card>

        <View style={{ gap: space.sm }}>
          <Text variant="subheading">Where to start</Text>
          {[
            "Open Drops and find a piece worth a second look.",
            "Build a look, or ask the concierge to build one for you.",
            "Preview it on yourself, then book a fitting to settle the fit.",
          ].map((line, index) => (
            <Text key={line} variant="bodySmall" tone="muted">
              {index + 1}. {line}
            </Text>
          ))}
        </View>
      </View>
    </Screen>
  );
}
